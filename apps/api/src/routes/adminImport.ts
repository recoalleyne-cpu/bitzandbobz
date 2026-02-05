import type { Request, Response } from "express";
import express from "express";
import multer = require("multer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse } = require("csv-parse/sync");
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { catalogCategories, catalogCategoryIds } from "@bitz/config/categories";
import { currency } from "@bitz/config/currency";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

function getPrisma(req: Request): PrismaClient {
  const prisma = req.app?.locals?.prisma as PrismaClient | undefined;
  if (!prisma) {
    throw new Error("Prisma client not found. Ensure app.locals.prisma is set.");
  }
  return prisma;
}

type CatalogCategoryId = (typeof catalogCategoryIds)[number];

const categoryLabelToId = new Map<string, CatalogCategoryId>(
  catalogCategories.map((category) => [category.label.toLowerCase(), category.id])
);

const categoryLabelAliases: Record<string, string> = {
  "diy tools & gadgets": "DIY Tools & Gadgets",
  "diy tools and gadgets": "DIY Tools & Gadgets",
  "diy tools gadgets": "DIY Tools & Gadgets",
  "mens accessories": "Men's Accessories",
  "men’s accessories": "Men's Accessories",
  "women accessories": "Women's Accessories",
  "womens accessories": "Women's Accessories",
  "women’s accessories": "Women's Accessories",
};

function normalizeCategoryId(input: string): CatalogCategoryId {
  const first = (input || "").split(",")[0]?.trim() ?? "";
  if (!first) return "SPECIAL";

  const normalized = first
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .toLowerCase();

  const alias = categoryLabelAliases[normalized];
  if (alias) {
    const match = categoryLabelToId.get(alias.toLowerCase());
    if (match) return match;
  }

  const matchByLabel = categoryLabelToId.get(normalized);
  if (matchByLabel) return matchByLabel;

  const maybeId = normalized
    .toUpperCase()
    .replace(/&/g, " ")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
  if (catalogCategoryIds.includes(maybeId as CatalogCategoryId)) {
    return maybeId as CatalogCategoryId;
  }

  return "SPECIAL";
}

function pick(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    const val = row[k];
    if (val !== undefined && val !== null && String(val).trim() !== "") return val;
  }
  return "";
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[’‘]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCents(value: string): number | null {
  const raw = (value || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const dollars = Number.parseFloat(cleaned);
  if (!Number.isFinite(dollars) || dollars <= 0) return null;
  return Math.round(dollars * 100);
}

function parseIntOr(value: string, fallback: number): number {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw.replace(/[^0-9-]/g, ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseBoolOr(value: string, fallback: boolean): boolean {
  const raw = (value || "").trim();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on", "published"].includes(raw.toLowerCase());
}

function parseImageUrls(value: string): string[] {
  const raw = (value || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,|\n]/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

const RowSchema = z.object({
  title: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().trim().max(1000).optional().nullable(),
  priceCents: z.number().int().positive(),
  category: z.enum(catalogCategoryIds).default("SPECIAL"),
  imageUrl: z.string().url().optional().nullable(),
  imageUrls: z.array(z.string().url()).default([]),
  stockQty: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

router.post(
  "/products",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Missing CSV file (field name: file)" });
      }

      const prisma = getPrisma(req);
      const csvText = req.file.buffer.toString("utf-8");
      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as Record<string, any>[];

      const errors: Array<{ row: number; message: string }> = [];
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (let i = 0; i < records.length; i++) {
        const r = records[i];

        const title = String(pick(r, ["title", "Title", "name", "Name"])).trim();
        const slugRaw = String(pick(r, ["slug", "Slug"])).trim();
        const slug = slugRaw || slugify(title);
        const description = String(
          pick(r, ["description", "Description", "Short description", "short_description"])
        ).trim();

        const priceCents =
          parseIntOr(String(pick(r, ["priceCents", "price_cents"])), NaN) ||
          parseCents(String(pick(r, ["price", "Regular price", "regular_price"]))) ||
          NaN;

        const categoryRaw = String(pick(r, ["category", "Categories", "Category"])).trim();
        const category = normalizeCategoryId(categoryRaw);

        const imagesRaw = String(pick(r, ["imageUrls", "Images", "images"])).trim();
        const imageUrls = parseImageUrls(imagesRaw);
        const imageUrl =
          String(pick(r, ["imageUrl", "Image", "image"])).trim() || imageUrls[0] || "";

        const stockQty = parseIntOr(
          String(pick(r, ["stockQty", "Stock", "Stock quantity", "stock_quantity"])),
          0
        );

        const active = parseBoolOr(String(pick(r, ["active", "Active", "Published", "published"])), true);

        const parsedRow = RowSchema.safeParse({
          title,
          slug,
          description: description || null,
          priceCents,
          currency: currency.code,
          category,
          imageUrl: imageUrl ? imageUrl : null,
          imageUrls,
          stockQty,
          active,
        });

        if (!parsedRow.success) {
          errors.push({
            row: i + 2,
            message: parsedRow.error.issues[0]?.message || "Invalid row",
          });
          skipped++;
          continue;
        }

        const data = parsedRow.data;

        try {
          const existing = await prisma.product.findUnique({
            where: { slug: data.slug },
            select: { id: true },
          });

          if (existing) {
            await prisma.product.update({
              where: { slug: data.slug },
              data: {
                title: data.title,
                description: data.description,
                priceCents: data.priceCents,
                currency: currency.code,
                category: data.category,
                imageUrl: data.imageUrl,
                imageUrls: data.imageUrls,
                stockQty: data.stockQty,
                active: data.active,
              },
            });
            updated += 1;
          } else {
            await prisma.product.create({
              data: {
                title: data.title,
                slug: data.slug,
                description: data.description,
                priceCents: data.priceCents,
                currency: currency.code,
                category: data.category,
                imageUrl: data.imageUrl,
                imageUrls: data.imageUrls,
                stockQty: data.stockQty,
                active: data.active,
              },
            });
            created += 1;
          }
        } catch (e: any) {
          errors.push({ row: i + 2, message: e?.message || "DB error" });
          skipped++;
        }
      }

      return res.json({ created, updated, skipped, errors });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Import failed" });
    }
  }
);

export default router;
