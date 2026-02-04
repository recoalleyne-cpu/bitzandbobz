import { PrismaClient, Category } from "@prisma/client";
import { brand } from "@bitz/config/brand";
import { currency } from "@bitz/config/currency";
import { calculateShippingCents, getDefaultShippingCountry } from "@bitz/config/shipping";

const prisma = new PrismaClient();

type SeedProduct = {
  title: string;
  slug: string;
  priceCents: number;
  currency: string;
  category: Category;
  stockQty: number;
  imageUrls: string[];
  active: boolean;
};

type SeedTemplate = {
  niche: string;
  categorySet: Category[];
  products: SeedProduct[];
  seedDemoOrder: boolean;
};

const defaultShippingCountry = getDefaultShippingCountry();

const templates: Record<string, SeedTemplate> = {
  default: {
    niche: "default",
    categorySet: [
      Category.CAR_ACCESSORIES,
      Category.DIY_TOOLS_GADGETS,
      Category.PHONE_ACCESSORIES,
      Category.MENS_ACCESSORIES,
      Category.WOMENS_ACCESSORIES,
      Category.SPECIAL
    ],
    products: [
      {
        title: "Car Tire Valve Caps Aluminum Alloy (4pcs) - Black",
        slug: "car-tire-valve-caps-black",
        priceCents: 1800,
        currency: currency.code,
        category: Category.CAR_ACCESSORIES,
        stockQty: 25,
        imageUrls: [],
        active: true
      },
      {
        title: "Screwdriver Keychain - Silver",
        slug: "screwdriver-keychain-silver",
        priceCents: 1200,
        currency: currency.code,
        category: Category.DIY_TOOLS_GADGETS,
        stockQty: 40,
        imageUrls: [],
        active: true
      },
      {
        title: "Anti-Drop Phone Case - iPhone 16 Pro",
        slug: "anti-drop-phone-case-iphone-16-pro",
        priceCents: 4500,
        currency: currency.code,
        category: Category.PHONE_ACCESSORIES,
        stockQty: 18,
        imageUrls: [],
        active: true
      },
      {
        title: "Waterproof Leather Men's Grooming Bag - Black",
        slug: "mens-grooming-bag-black",
        priceCents: 6500,
        currency: currency.code,
        category: Category.MENS_ACCESSORIES,
        stockQty: 12,
        imageUrls: [],
        active: true
      },
      {
        title: "Corduroy Travel Bag - Pink",
        slug: "corduroy-bag-pink",
        priceCents: 2500,
        currency: currency.code,
        category: Category.WOMENS_ACCESSORIES,
        stockQty: 22,
        imageUrls: [],
        active: true
      },
      {
        title: "Special Deal: Mystery Bundle",
        slug: "special-mystery-bundle",
        priceCents: 9900,
        currency: currency.code,
        category: Category.SPECIAL,
        stockQty: 10,
        imageUrls: [],
        active: true
      }
    ],
    seedDemoOrder: true
  },
  phones: {
    niche: "phones",
    categorySet: [Category.PHONE_ACCESSORIES, Category.SPECIAL],
    products: [
      {
        title: "MagSafe Clear Case - iPhone 16 Pro",
        slug: "magsafe-clear-case-iphone-16-pro",
        priceCents: 5500,
        currency: currency.code,
        category: Category.PHONE_ACCESSORIES,
        stockQty: 30,
        imageUrls: [],
        active: true
      },
      {
        title: "Tempered Glass Screen Protector (2-pack) - iPhone 16 Pro",
        slug: "screen-protector-2pack-iphone-16-pro",
        priceCents: 3200,
        currency: currency.code,
        category: Category.PHONE_ACCESSORIES,
        stockQty: 45,
        imageUrls: [],
        active: true
      },
      {
        title: "USB-C Fast Charger 20W",
        slug: "usb-c-fast-charger-20w",
        priceCents: 4000,
        currency: currency.code,
        category: Category.PHONE_ACCESSORIES,
        stockQty: 35,
        imageUrls: [],
        active: true
      },
      {
        title: "Braided USB-C to USB-C Cable (2m)",
        slug: "braided-usb-c-cable-2m",
        priceCents: 2500,
        currency: currency.code,
        category: Category.PHONE_ACCESSORIES,
        stockQty: 50,
        imageUrls: [],
        active: true
      },
      {
        title: "Special Deal: Phone Essentials Bundle",
        slug: "special-phone-essentials-bundle",
        priceCents: 11900,
        currency: currency.code,
        category: Category.SPECIAL,
        stockQty: 12,
        imageUrls: [],
        active: true
      }
    ],
    seedDemoOrder: true
  }
};

function parseSeedNiche(): string {
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--niche") return args[index + 1] || "";
    if (arg.startsWith("--niche=")) return arg.slice("--niche=".length);
    if (!arg.startsWith("-")) return arg;
  }
  return process.env.SEED_NICHE || "default";
}

async function main() {
  const niche = parseSeedNiche().trim().toLowerCase() || "default";
  const template = templates[niche];
  if (!template) {
    const available = Object.keys(templates).sort().join(", ");
    throw new Error(`Unknown seed niche "${niche}". Available: ${available}`);
  }

  for (const product of template.products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product
    });
  }

  const orderCount = await prisma.order.count();
  if (template.seedDemoOrder && orderCount === 0) {
    const [first, second] = await prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      take: 2
    });

    if (first && second) {
      const shippingCents = calculateShippingCents("Saint Michael");
      const subtotalCents = (first.priceCents * 2) + second.priceCents;
      const totalCents = subtotalCents + shippingCents;
      await prisma.order.create({
        data: {
          customerName: "Demo Customer",
          customerPhone: "+1-246-555-0101",
          customerEmail: `demo@${brand.storeName.toLowerCase().replace(/\s+/g, "")}.local`,
          shippingAddress1: "Demo Street, Bridgetown",
          shippingAddress2: null,
          parish: "Saint Michael",
          shippingCountry: defaultShippingCountry.name,
          currency: currency.code,
          subtotalCents,
          shippingCents,
          totalCents,
          status: "PAID",
          items: {
            create: [
              {
                productId: first.id,
                quantity: 2,
                unitPriceCents: first.priceCents,
                titleSnapshot: first.title
              },
              {
                productId: second.id,
                quantity: 1,
                unitPriceCents: second.priceCents,
                titleSnapshot: second.title
              }
            ]
          }
        }
      });
    }
  }

  console.log(`Seeded niche: ${template.niche}`);
  console.log("Seeded categories:", template.categorySet.join(", "));
  console.log("Seeded products:", template.products.length);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
