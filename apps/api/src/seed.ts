import { PrismaClient, Category } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const items = [
    {
      title: "Car Tire Valve Caps Aluminum Alloy (4pcs) - Black",
      slug: "car-tire-valve-caps-black",
      priceCents: 1800,
      currency: "BBD",
      category: Category.CAR_ACCESSORIES,
      stockQty: 25,
      imageUrls: []
    },
    {
      title: "Screwdriver Keychain - Silver",
      slug: "screwdriver-keychain-silver",
      priceCents: 1200,
      currency: "BBD",
      category: Category.DIY_TOOLS_GADGETS,
      stockQty: 40,
      imageUrls: []
    },
    {
      title: "Anti-Drop Phone Case - iPhone 16 Pro",
      slug: "anti-drop-phone-case-iphone-16-pro",
      priceCents: 4500,
      currency: "BBD",
      category: Category.PHONE_ACCESSORIES,
      stockQty: 18,
      imageUrls: []
    },
    {
      title: "Waterproof Leather Men's Grooming Bag - Black",
      slug: "mens-grooming-bag-black",
      priceCents: 6500,
      currency: "BBD",
      category: Category.MENS_ACCESSORIES,
      stockQty: 12,
      imageUrls: []
    },
    {
      title: "Corduroy Travel Bag - Pink",
      slug: "corduroy-bag-pink",
      priceCents: 2500,
      currency: "BBD",
      category: Category.WOMENS_ACCESSORIES,
      stockQty: 22,
      imageUrls: []
    },
    {
      title: "Special Deal: Mystery Bundle",
      slug: "special-mystery-bundle",
      priceCents: 9900,
      currency: "BBD",
      category: Category.SPECIAL,
      stockQty: 10,
      imageUrls: []
    }
  ];

  for (const product of items) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: product,
      create: product
    });
  }

  const orderCount = await prisma.order.count();
  if (orderCount === 0) {
    const [first, second] = await prisma.product.findMany({
      orderBy: { createdAt: "asc" },
      take: 2
    });

    if (first && second) {
      await prisma.order.create({
        data: {
          customerName: "Demo Customer",
          customerPhone: "+1-246-555-0101",
          customerEmail: "demo@bitzbobz.local",
          shippingAddress1: "Demo Street, Bridgetown",
          shippingAddress2: null,
          parish: "Saint Michael",
          shippingCountry: "Barbados",
          currency: "BBD",
          subtotalCents: (first.priceCents * 2) + second.priceCents,
          shippingCents: 1200,
          totalCents: (first.priceCents * 2) + second.priceCents + 1200,
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

  console.log("Seeded products:", items.length);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
