import express from "express";
import adminImport from "./routes/adminImport";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { brand } from "@bitz/config/brand";
import { catalogCategoryIds } from "@bitz/config/categories";
import { currency } from "@bitz/config/currency";
import {
  calculateShippingCents,
  getDefaultShippingCountry,
  isAllowedShippingCountry
} from "@bitz/config/shipping";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, "../../.env")
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) dotenv.config({ path: envPath });
else dotenv.config();

const app = express();
const prisma = new PrismaClient();
app.locals.prisma = prisma;
const port = Number(process.env.PORT || 4000);
const adminPassword = process.env.ADMIN_PASSWORD || "changeme";
const adminTokenSecret = process.env.ADMIN_JWT_SECRET || "local-dev-secret";
const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "";
const fallbackOpsEmail = `ops@${brand.storeName.toLowerCase().replace(/\s+/g, "")}.local`;
const adminDailySummaryEmail = process.env.ADMIN_DAILY_SUMMARY_EMAIL || fallbackOpsEmail;

app.use(express.json());

function encodeImageUrls(urls: unknown): string {
  if (Array.isArray(urls)) return JSON.stringify(urls);
  if (typeof urls === "string" && urls.trim().startsWith("[")) return urls; // already JSON
  return "[]";
}

function decodeImageUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseCsvEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

const allowedOrigins = new Set(
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    process.env.CORS_ORIGIN_STORE,
    process.env.CORS_ORIGIN_ADMIN,
    ...parseCsvEnv(process.env.CORS_ORIGINS),
  ].filter((origin): origin is string => Boolean(origin))
);

const allowVercelPreviewOrigins =
  isTruthy(process.env.CORS_ALLOW_VERCEL_PREVIEW) ||
  parseCsvEnv(process.env.CORS_ALLOWED_VERCEL_PROJECTS).length > 0;

const allowedVercelProjects = parseCsvEnv(process.env.CORS_ALLOWED_VERCEL_PROJECTS).map((project) => project.toLowerCase());

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    if (allowVercelPreviewOrigins) {
      try {
        const parsed = new URL(origin);
        const hostname = parsed.hostname.toLowerCase();
        if (parsed.protocol === "https:" && hostname.endsWith(".vercel.app")) {
          if (allowedVercelProjects.length === 0) {
            callback(null, true);
            return;
          }
          for (const project of allowedVercelProjects) {
            if (hostname === `${project}.vercel.app` || hostname.startsWith(`${project}-`)) {
              callback(null, true);
              return;
            }
          }
        }
      } catch {
        // ignore invalid origins
      }
    }
    callback(new Error("Not allowed by CORS"));
  }
}));

const defaultShippingCountry = getDefaultShippingCountry();
const shippingRestrictionMessage = `Shipping is only available in ${defaultShippingCountry.name}.`;

const currencyCodeSchema = z.literal(currency.code);
const categorySchema = z.enum(catalogCategoryIds);
const loginSchema = z.object({ password: z.string().min(1) });
const orderStatusSchema = z.object({
  status: z.enum(["PENDING", "PAID", "PACKED", "SHIPPED", "CANCELLED"])
});
const analyticsEventSchema = z.object({
  eventType: z.string().trim().min(2).max(64),
  sessionId: z.string().trim().min(2).max(128),
  payload: z.record(z.string(), z.any()).optional()
});

const productPayloadSchema = z.object({
  title: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().trim().max(1000).optional().nullable(),
  priceCents: z.number().int().positive(),
  currency: currencyCodeSchema.default(currency.code),
  category: categorySchema,
  imageUrl: z.string().url().optional().nullable(),
  imageUrls: z.array(z.string().url()).optional(),
  stockQty: z.number().int().nonnegative(),
  active: z.boolean().optional()
});
function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.header("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  // Optional: also allow x-admin-key for curl/admin tools
  const xKey = (req.header("x-admin-key") || "").trim();

  const got = bearer || xKey;

  if (!got) {
    return res.status(401).json({ error: "Missing admin token." });
  }

  // 1) Accept static ADMIN_API_KEY if configured (great for imports)
  const staticKey = (process.env.ADMIN_API_KEY || "").trim();
  if (staticKey && got === staticKey) {
    return next();
  }

  // 2) Otherwise fall back to the existing signed token mechanism
  if (!verifyAdminToken(got)) {
    return res.status(401).json({ error: "Invalid or expired admin token." });
  }

  return next();
}

const checkoutLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive()
});

const checkoutSchema = z.object({
  currency: currencyCodeSchema,
  shippingCountry: z
    .string()
    .trim()
    .refine((value) => isAllowedShippingCountry(value), {
      message: shippingRestrictionMessage
    }),
  items: z.array(checkoutLineSchema).min(1)
});

const checkoutSubmitSchema = checkoutSchema.extend({
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(5),
  customerEmail: z.string().trim().email(),
  shippingAddress: z.string().trim().min(5),
  parish: z.string().trim().max(100).optional().nullable(),
  paymentMethod: z.enum(["SIMULATED_CARD"])
});

const analyticsFile = path.resolve(__dirname, "../data/analytics-events.json");
const paymentFile = path.resolve(__dirname, "../data/payment-events.json");
const outboxFile = path.resolve(__dirname, "../data/notification-outbox.json");
const errorLogFile = path.resolve(__dirname, "../data/error.log");

function readJsonArray(filePath: string): Array<Record<string, unknown>> {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(filePath: string, entries: Array<Record<string, unknown>>) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2));
}

function appendJsonEvent(filePath: string, entry: Record<string, unknown>) {
  const entries = readJsonArray(filePath);
  entries.push(entry);
  writeJsonArray(filePath, entries);
}

function appendErrorLog(message: string) {
  const logLine = `${new Date().toISOString()} ${message}\n`;
  const dir = path.dirname(errorLogFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(errorLogFile, logLine);
}

function queueNotification(entry: Record<string, unknown>) {
  appendJsonEvent(outboxFile, {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry
  });
}

function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, Array<number>>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = `${req.ip || "unknown"}:${req.path}`;
    const now = Date.now();
    const previous = hits.get(key) || [];
    const active = previous.filter((timestamp) => now - timestamp < windowMs);
    active.push(now);
    hits.set(key, active);
    if (active.length > limit) {
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }
    next();
  };
}

const authRateLimiter = createRateLimiter(15, 60_000);
const checkoutRateLimiter = createRateLimiter(60, 60_000);
const adminRateLimiter = createRateLimiter(120, 60_000);
app.use("/admin/login", authRateLimiter);
app.use("/admin", adminRateLimiter);
app.use("/checkout", checkoutRateLimiter);

//  Mount CSV importer
app.use("/admin/import", requireAdminAuth, adminImport);

async function getCheckoutSummary(items: Array<{ productId: string; quantity: number }>) {
  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true }
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) throw new Error(`Product not found: ${item.productId}`);
    if (product.stockQty < item.quantity) throw new Error(`Insufficient stock for ${product.title}`);
  }

  const subtotalCents = items.reduce((sum, item) => {
    const product = productById.get(item.productId)!;
    return sum + (product.priceCents * item.quantity);
  }, 0);

  return { productById, subtotalCents };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/catalog/categories", (_req, res) => {
  res.json(catalogCategoryIds);
});

app.get("/catalog/products", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const category = String(req.query.category || "").trim();

  const whereClause: Record<string, unknown> = { active: true };
  if (search) {
    whereClause.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
    ];
  }
  if (category && catalogCategoryIds.includes(category as (typeof catalogCategoryIds)[number])) {
    whereClause.category = category;
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" }
  });
  res.json(
    products.map((p) => ({
      ...p,
      imageUrls: decodeImageUrls((p as any).imageUrls)
    }))
  );
});

app.get("/catalog/products/:slug", async (req, res) => {
  const slug = req.params.slug;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || !product.active) return res.status(404).json({ error: "Product not found." });

  const related = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      active: true,
      category: product.category
    },
    take: 4,
    orderBy: { createdAt: "desc" }
  });

  return res.json({
    product: { ...product, imageUrls: decodeImageUrls((product as any).imageUrls) },
    related: related.map((p) => ({ ...p, imageUrls: decodeImageUrls((p as any).imageUrls) }))
  });
});

app.post("/analytics/events", async (req, res) => {
  const parsed = analyticsEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const event = {
    id: crypto.randomUUID(),
    eventType: parsed.data.eventType,
    sessionId: parsed.data.sessionId,
    payload: parsed.data.payload || {},
    createdAt: new Date().toISOString()
  };
  appendJsonEvent(analyticsFile, event);
  return res.status(201).json({ id: event.id });
});

app.post("/admin/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.password.length !== adminPassword.length) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const passwordMatch = crypto.timingSafeEqual(Buffer.from(parsed.data.password), Buffer.from(adminPassword));
  if (!passwordMatch) return res.status(401).json({ error: "Invalid credentials." });

  const token = signAdminToken();
  return res.json({ token });
});

app.get("/admin/products", requireAdminAuth, async (_req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  res.json(products);
});

app.post("/admin/products", requireAdminAuth, async (req, res) => {
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const created = await prisma.product.create({
    data: {
      ...parsed.data,
      imageUrls: encodeImageUrls(parsed.data.imageUrls)
    }
  });
  return res.status(201).json(created);
});

app.put("/admin/products/:id", requireAdminAuth, async (req, res) => {
  const idCheck = z.object({ id: z.string().min(1) }).safeParse(req.params);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid product id." });

  const parsed = productPayloadSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const updated = await prisma.product.update({
      where: { id: idCheck.data.id },
      data: {
        ...parsed.data,
        ...(parsed.data.imageUrls ? { imageUrls: encodeImageUrls(parsed.data.imageUrls) } : {})
      }
    });
    return res.json(updated);
  } catch {
    return res.status(404).json({ error: "Product not found." });
  }
});

app.delete("/admin/products/:id", requireAdminAuth, async (req, res) => {
  const idCheck = z.object({ id: z.string().min(1) }).safeParse(req.params);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid product id." });

  try {
    await prisma.product.delete({ where: { id: idCheck.data.id } });
    return res.status(204).send();
  } catch {
    return res.status(404).json({ error: "Product not found." });
  }
});

app.get("/admin/orders", requireAdminAuth, async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: true } }
    }
  });

  const paymentEvents = readJsonArray(paymentFile);
  const byOrder = new Map<string, string>();
  for (const event of paymentEvents) {
    const orderId = typeof event.orderId === "string" ? event.orderId : "";
    const status = typeof event.status === "string" ? event.status : "";
    if (orderId && status) byOrder.set(orderId, status);
  }

  const response = orders.map((order) => ({
    ...order,
    payments: [{ status: byOrder.get(order.id) || (order.status === "PAID" ? "PAID" : "PENDING") }]
  }));

  return res.json(response);
});

app.put("/admin/orders/:id/status", requireAdminAuth, async (req, res) => {
  const idCheck = z.object({ id: z.string().min(1) }).safeParse(req.params);
  if (!idCheck.success) return res.status(400).json({ error: "Invalid order id." });

  const parsed = orderStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const order = await prisma.order.update({
      where: { id: idCheck.data.id },
      data: { status: parsed.data.status }
    });
    return res.json(order);
  } catch {
    return res.status(404).json({ error: "Order not found." });
  }
});

app.get("/admin/analytics/summary", requireAdminAuth, async (_req, res) => {
  const events = readJsonArray(analyticsFile);
  const count = (name: string) => events.filter((event) => event.eventType === name).length;
  return res.json({
    views: count("view_product"),
    addToCart: count("add_to_cart"),
    beginCheckout: count("begin_checkout"),
    purchases: count("purchase")
  });
});

app.get("/admin/automations/outbox", requireAdminAuth, async (_req, res) => {
  return res.json(readJsonArray(outboxFile));
});

app.post("/admin/automations/daily-sales-email", requireAdminAuth, async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 1);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, totalCents: true }
  });

  const revenueCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  queueNotification({
    channel: "email",
    to: adminDailySummaryEmail,
    subject: "Daily Sales Summary",
    eventType: "daily_sales_summary",
    payload: {
      orderCount: orders.length,
      revenueCents,
      generatedAt: new Date().toISOString()
    }
  });

  return res.json({ queued: true, orderCount: orders.length, revenueCents });
});

app.post("/admin/automations/notify", requireAdminAuth, async (req, res) => {
  const parsed = z.object({
    channel: z.enum(["email", "sms", "whatsapp"]),
    to: z.string().trim().min(3),
    message: z.string().trim().min(1)
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  queueNotification({
    channel: parsed.data.channel,
    to: parsed.data.to,
    subject: "Manual notification",
    eventType: "manual_notification",
    payload: { message: parsed.data.message }
  });

  return res.status(202).json({ queued: true });
});

app.get("/admin/reports/daily-sales", requireAdminAuth, async (_req, res) => {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, totalCents: true }
  });

  const byDay = new Map<string, number>();
  for (const order of orders) {
    const day = order.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + order.totalCents);
  }

  const rows = Array.from(byDay.entries()).map(([date, totalCents]) => ({ date, totalCents }));
  return res.json(rows);
});

app.get("/admin/alerts/low-stock", requireAdminAuth, async (_req, res) => {
  const lowStock = await prisma.product.findMany({
    where: { stockQty: { lte: 5 } },
    orderBy: { stockQty: "asc" }
  });
  return res.json(lowStock);
});

app.get("/admin/customers/export.csv", requireAdminAuth, async (_req, res) => {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      shippingAddress1: true,
      parish: true,
      createdAt: true
    }
  });

  const header = "name,email,phone,address,parish,createdAt";
  const rows = orders.map((order) => {
    const values = [
      order.customerName,
      order.customerEmail || "",
      order.customerPhone || "",
      order.shippingAddress1,
      order.parish || "",
      order.createdAt.toISOString()
    ];
    return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=customers.csv");
  return res.send([header, ...rows].join("\n"));
});

app.post("/checkout/validate", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { subtotalCents } = await getCheckoutSummary(parsed.data.items);
    return res.json({
      ok: true,
      currency: currency.code,
      shippingCountry: defaultShippingCountry.name,
      subtotalCents
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Checkout validation failed." });
  }
});

app.post("/checkout/quote", async (req, res) => {
  const parsed = checkoutSchema.extend({ parish: z.string().trim().optional().nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const { subtotalCents } = await getCheckoutSummary(parsed.data.items);
    const shippingCents = calculateShippingCents(parsed.data.parish || null);
    return res.json({
      currency: currency.code,
      subtotalCents,
      shippingCents,
      totalCents: subtotalCents + shippingCents
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Could not quote checkout." });
  }
});

app.post("/checkout/submit", async (req, res) => {
  const parsed = checkoutSubmitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    if (!isAllowedShippingCountry(parsed.data.shippingCountry)) {
      return res.status(400).json({ error: shippingRestrictionMessage });
    }

    const { productById, subtotalCents } = await getCheckoutSummary(parsed.data.items);
    const shippingCents = calculateShippingCents(parsed.data.parish || null);
    const totalCents = subtotalCents + shippingCents;

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerName: parsed.data.customerName,
          customerPhone: parsed.data.customerPhone,
          customerEmail: parsed.data.customerEmail,
          shippingAddress1: parsed.data.shippingAddress,
          shippingAddress2: null,
          parish: parsed.data.parish || null,
          shippingCountry: defaultShippingCountry.name,
          currency: currency.code,
          subtotalCents,
          shippingCents,
          totalCents,
          status: "PAID",
          items: {
            create: parsed.data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPriceCents: productById.get(item.productId)!.priceCents,
              titleSnapshot: productById.get(item.productId)!.title
            }))
          }
        }
      });

      for (const item of parsed.data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } }
        });
      }

      return created;
    });

    appendJsonEvent(analyticsFile, {
      id: crypto.randomUUID(),
      eventType: "purchase",
      sessionId: `order:${order.id}`,
      payload: { orderId: order.id, totalCents, itemCount: parsed.data.items.length },
      createdAt: new Date().toISOString()
    });

    appendJsonEvent(paymentFile, {
      id: crypto.randomUUID(),
      orderId: order.id,
      status: "PAID",
      provider: "SIMULATED",
      amountCents: totalCents,
      currency: currency.code,
      createdAt: new Date().toISOString()
    });

    queueNotification({
      channel: "email",
      to: parsed.data.customerEmail,
      subject: `Order Confirmation (${order.id})`,
      eventType: "order_confirmation",
      payload: {
        orderId: order.id,
        customerName: parsed.data.customerName,
        totalCents
      }
    });

    const lowStockProducts = await prisma.product.findMany({
      where: { stockQty: { lte: 5 } },
      select: { id: true, title: true, stockQty: true }
    });
    if (lowStockProducts.length > 0) {
      queueNotification({
        channel: "email",
        to: adminDailySummaryEmail,
        subject: "Low Stock Alert",
        eventType: "low_stock_alert",
        payload: { products: lowStockProducts }
      });
    }

    return res.status(201).json({
      ok: true,
      orderId: order.id,
      currency: currency.code,
      subtotalCents,
      shippingCents,
      totalCents,
      paymentStatus: "PAID",
      fulfillmentStatus: "PAID"
    });
  } catch (error) {
    appendErrorLog(`/checkout/submit ${error instanceof Error ? error.message : "unknown error"}`);
    return res.status(400).json({ error: error instanceof Error ? error.message : "Checkout failed." });
  }
});

app.post("/payments/webhook/simulated", async (req, res) => {
  const signature = req.header("x-webhook-signature");
  if (webhookSecret) {
    if (!signature) {
      return res.status(401).json({ error: "Missing webhook signature." });
    }
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).json({ error: "Invalid webhook signature." });
    }
  }

  const parsed = z.object({
    orderId: z.string().min(1),
    status: z.enum(["PENDING", "PAID", "FAILED"])
  }).safeParse(req.body);

  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  appendJsonEvent(paymentFile, {
    id: crypto.randomUUID(),
    orderId: parsed.data.orderId,
    status: parsed.data.status,
    provider: "SIMULATED",
    createdAt: new Date().toISOString()
  });

  if (parsed.data.status === "PAID") {
    await prisma.order.update({ where: { id: parsed.data.orderId }, data: { status: "PAID" } }).catch(() => undefined);
  }

  return res.json({ ok: true });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  appendErrorLog(err.message);
  return res.status(500).json({ error: "Internal server error." });
});

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
