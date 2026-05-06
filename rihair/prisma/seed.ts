import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import slugify from "slugify";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding RI Hair Collectables database...");

  // Super Admin
  const adminPassword = await hash("Admin@RIHair2024!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@rihaircollectables.com" },
    update: {},
    create: {
      email: "admin@rihaircollectables.com",
      firstName: "RI Hair",
      lastName: "Admin",
      name: "RI Hair Admin",
      passwordHash: adminPassword,
      role: "SUPER_ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log("✅ Admin user created:", admin.email);

  // Categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "human-hair-wigs" },
      update: {},
      create: { slug: "human-hair-wigs", name: "Human Hair Wigs", type: "HUMAN_HAIR_WIGS", sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { slug: "frontal-wigs" },
      update: {},
      create: { slug: "frontal-wigs", name: "Frontal Wigs", type: "FRONTAL_WIGS", sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { slug: "closure-wigs" },
      update: {},
      create: { slug: "closure-wigs", name: "Closure Wigs", type: "CLOSURE_WIGS", sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { slug: "hair-bundles" },
      update: {},
      create: { slug: "hair-bundles", name: "Hair Bundles", type: "HAIR_BUNDLES", sortOrder: 4 },
    }),
    prisma.category.upsert({
      where: { slug: "raw-virgin-hair" },
      update: {},
      create: { slug: "raw-virgin-hair", name: "Raw Virgin Hair", type: "RAW_VIRGIN_HAIR", sortOrder: 5 },
    }),
    prisma.category.upsert({
      where: { slug: "hair-accessories" },
      update: {},
      create: { slug: "hair-accessories", name: "Hair Accessories", type: "HAIR_ACCESSORIES", sortOrder: 6 },
    }),
    prisma.category.upsert({
      where: { slug: "custom-wigs" },
      update: {},
      create: { slug: "custom-wigs", name: "Custom Wigs", type: "CUSTOM_WIGS", sortOrder: 7 },
    }),
  ]);
  console.log("✅ Categories seeded:", categories.length);

  // Sample Products
  const frontalsCategory = categories.find((c) => c.slug === "frontal-wigs")!;
  const bundlesCategory = categories.find((c) => c.slug === "hair-bundles")!;

  const product1Slug = "brazilian-body-wave-frontal-wig-hd-lace";
  const product1 = await prisma.product.upsert({
    where: { slug: product1Slug },
    update: {},
    create: {
      slug: product1Slug,
      sku: "RH-FRO-BRBW-0001",
      name: "Brazilian Body Wave Frontal Wig — HD Lace",
      shortDescription:
        "Premium 13×4 HD lace frontal wig in silky Brazilian body wave. Undetectable hairline, pre-plucked with baby hair.",
      description: `Experience the ultimate natural hairline with our Brazilian Body Wave HD Lace Frontal Wig.

Crafted from 100% raw Brazilian virgin hair, this wig features an undetectable 13×4 HD lace front that melts seamlessly into all skin tones. Pre-plucked with natural-looking baby hair for an effortlessly realistic finish.

The body wave texture adds glamorous volume and movement that holds beautifully — whether air dried or styled with heat. Each strand is cuticle-aligned for tangle-free wear and longevity.

• Hair Type: 100% Raw Brazilian Virgin Hair
• Lace: 13×4 HD Lace Front
• Cap Construction: Medium cap with adjustable straps
• Pre-Plucked: Yes, with baby hair
• Bleached Knots: Available on request
• Can be coloured, bleached, and restyled`,
      status: "ACTIVE",
      categoryId: frontalsCategory.id,
      hairOrigin: "BRAZILIAN",
      hairTexture: "BODY_WAVE",
      laceType: "HD_LACE",
      basePrice: 280,
      compareAtPrice: 350,
      currency: "USD",
      isFeatured: true,
      isBestSeller: true,
      isNewArrival: false,
      isOnSale: true,
      tags: ["wig", "brazilian", "body-wave", "hd-lace", "frontal"],
      seoTitle: "Brazilian Body Wave HD Lace Frontal Wig | RI Hair Collectables",
      seoDesc: "Premium 13×4 HD lace Brazilian body wave frontal wig. Pre-plucked, baby hair, cuticle-aligned. Ships worldwide.",
      publishedAt: new Date(),
      variants: {
        create: [
          { sku: "RH-FRO-BRBW-0001-16-150", lengthInches: 16, density: "DENSITY_150", price: 280, compareAtPrice: 350, stockQuantity: 8 },
          { sku: "RH-FRO-BRBW-0001-18-150", lengthInches: 18, density: "DENSITY_150", price: 310, compareAtPrice: 385, stockQuantity: 6 },
          { sku: "RH-FRO-BRBW-0001-20-150", lengthInches: 20, density: "DENSITY_150", price: 340, compareAtPrice: 420, stockQuantity: 5 },
          { sku: "RH-FRO-BRBW-0001-22-180", lengthInches: 22, density: "DENSITY_180", price: 390, compareAtPrice: 480, stockQuantity: 4 },
          { sku: "RH-FRO-BRBW-0001-24-180", lengthInches: 24, density: "DENSITY_180", price: 430, compareAtPrice: 530, stockQuantity: 3 },
          { sku: "RH-FRO-BRBW-0001-26-250", lengthInches: 26, density: "DENSITY_250", price: 510, compareAtPrice: 640, stockQuantity: 2 },
          { sku: "RH-FRO-BRBW-0001-28-250", lengthInches: 28, density: "DENSITY_250", price: 580, compareAtPrice: 720, stockQuantity: 2 },
        ],
      },
    },
  });

  const product2Slug = "peruvian-straight-bundles-3-pack";
  await prisma.product.upsert({
    where: { slug: product2Slug },
    update: {},
    create: {
      slug: product2Slug,
      sku: "RH-BUN-PEST-0001",
      name: "Peruvian Straight Bundles — 3 Pack",
      shortDescription:
        "Silky smooth Peruvian straight bundles. Double weft, thick from root to tip, minimal shedding.",
      description: `Our Peruvian Straight Bundles are harvested from a single donor for consistent thickness and cuticle alignment from root to tip.

This 3-pack provides enough hair for a full, voluminous install. The natural straight texture is sleek, manageable, and can be curled, flat ironed, and coloured.

• Hair Type: 100% Raw Peruvian Virgin Hair
• Bundle Count: 3 bundles (each ~100g)
• Double weft for maximum volume
• Cuticle aligned, tangle-free
• Minimal shedding
• Can be bleached, coloured, and restyled`,
      status: "ACTIVE",
      categoryId: bundlesCategory.id,
      hairOrigin: "PERUVIAN",
      hairTexture: "STRAIGHT",
      basePrice: 180,
      currency: "USD",
      isFeatured: true,
      isBestSeller: true,
      tags: ["bundles", "peruvian", "straight"],
      publishedAt: new Date(),
      variants: {
        create: [
          { sku: "RH-BUN-PEST-0001-14", lengthInches: 14, price: 180, stockQuantity: 12 },
          { sku: "RH-BUN-PEST-0001-16", lengthInches: 16, price: 200, stockQuantity: 10 },
          { sku: "RH-BUN-PEST-0001-18", lengthInches: 18, price: 220, stockQuantity: 8 },
          { sku: "RH-BUN-PEST-0001-20", lengthInches: 20, price: 250, stockQuantity: 7 },
          { sku: "RH-BUN-PEST-0001-22", lengthInches: 22, price: 280, stockQuantity: 5 },
          { sku: "RH-BUN-PEST-0001-24", lengthInches: 24, price: 320, stockQuantity: 4 },
        ],
      },
    },
  });

  // Testimonials
  await prisma.testimonial.createMany({
    skipDuplicates: true,
    data: [
      { name: "Adaeze Okonkwo", location: "Lagos, Nigeria", rating: 5, content: "Absolutely obsessed with my frontal wig from RI Hair. The HD lace is literally undetectable — everyone keeps asking if it's my real hair. Quality is 10/10 and delivery was fast!", sortOrder: 0 },
      { name: "Kemi Adeyemi", location: "Abuja, Nigeria", rating: 5, content: "I've been ordering from RI Hair for two years. The Brazilian body wave bundles are thick, bouncy and hold colour beautifully. Their customer service is always on point.", sortOrder: 1 },
      { name: "Akosua Mensah", location: "Accra, Ghana", rating: 5, content: "The 28\" deep wave wig arrived in perfect condition. The install was flawless. I've never felt more confident. Worth every pesewa!", sortOrder: 2 },
      { name: "Funmi Balogun", location: "London, UK", rating: 5, content: "Ordered the Cambodian curly wig for a special event. It arrived in 3 days, pre-styled and gorgeous. RI Hair is my only go-to now.", sortOrder: 3 },
      { name: "Temi Williams", location: "Houston, USA", rating: 5, content: "My third purchase and every single time it exceeds expectations. The raw Indian straight bundles are incredibly soft with zero shedding.", sortOrder: 4 },
      { name: "Chioma Eze", location: "Toronto, Canada", rating: 5, content: "The wig installation service was an experience. My stylist was so skilled and the result looked completely natural. Already booked my second appointment!", sortOrder: 5 },
    ],
  });

  // Shipping Zones
  const zones = await Promise.all([
    prisma.shippingZone.upsert({
      where: { id: "zone-nigeria" },
      update: {},
      create: { id: "zone-nigeria", name: "Nigeria", region: "NIGERIA", countries: ["NG"], sortOrder: 1 },
    }),
    prisma.shippingZone.upsert({
      where: { id: "zone-ghana" },
      update: {},
      create: { id: "zone-ghana", name: "Ghana", region: "GHANA", countries: ["GH"], sortOrder: 2 },
    }),
    prisma.shippingZone.upsert({
      where: { id: "zone-uk" },
      update: {},
      create: { id: "zone-uk", name: "United Kingdom", region: "UNITED_KINGDOM", countries: ["GB"], sortOrder: 3 },
    }),
    prisma.shippingZone.upsert({
      where: { id: "zone-usa" },
      update: {},
      create: { id: "zone-usa", name: "United States", region: "UNITED_STATES", countries: ["US"], sortOrder: 4 },
    }),
    prisma.shippingZone.upsert({
      where: { id: "zone-canada" },
      update: {},
      create: { id: "zone-canada", name: "Canada", region: "CANADA", countries: ["CA"], sortOrder: 5 },
    }),
  ]);

  await prisma.shippingRate.createMany({
    skipDuplicates: true,
    data: [
      { zoneId: zones[0]!.id, name: "Standard Delivery", carrier: "GIG Logistics", rate: 2500, estimatedDaysMin: 2, estimatedDaysMax: 5 },
      { zoneId: zones[0]!.id, name: "Express Delivery", carrier: "DHL", rate: 5000, estimatedDaysMin: 1, estimatedDaysMax: 2 },
      { zoneId: zones[1]!.id, name: "Standard Delivery", carrier: "DHL", rate: 80, estimatedDaysMin: 3, estimatedDaysMax: 7 },
      { zoneId: zones[2]!.id, name: "Standard Shipping", carrier: "Royal Mail", rate: 15, estimatedDaysMin: 5, estimatedDaysMax: 10 },
      { zoneId: zones[2]!.id, name: "Express Shipping", carrier: "DHL Express", rate: 35, estimatedDaysMin: 2, estimatedDaysMax: 4 },
      { zoneId: zones[3]!.id, name: "Standard Shipping", carrier: "USPS", rate: 18, estimatedDaysMin: 7, estimatedDaysMax: 14 },
      { zoneId: zones[3]!.id, name: "Express Shipping", carrier: "FedEx", rate: 40, estimatedDaysMin: 3, estimatedDaysMax: 5 },
      { zoneId: zones[4]!.id, name: "Standard Shipping", carrier: "Canada Post", rate: 22, estimatedDaysMin: 7, estimatedDaysMax: 14 },
      { zoneId: zones[4]!.id, name: "Express Shipping", carrier: "DHL Express", rate: 45, estimatedDaysMin: 3, estimatedDaysMax: 5 },
    ],
  });

  // Sample booking slots
  const now = new Date();
  for (let d = 1; d <= 14; d++) {
    const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const slots = [
      { startTime: "10:00", endTime: "12:00" },
      { startTime: "12:30", endTime: "14:30" },
      { startTime: "15:00", endTime: "17:00" },
    ];

    for (const slot of slots) {
      for (const service of ["WIG_INSTALLATION", "HAIR_CONSULTATION", "CUSTOM_WIG_CREATION"] as const) {
        await prisma.bookingSlot.create({
          data: {
            service,
            date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            duration: service === "HAIR_CONSULTATION" ? 45 : service === "WIG_INSTALLATION" ? 120 : 180,
            price: service === "HAIR_CONSULTATION" ? 30 : service === "WIG_INSTALLATION" ? 80 : 250,
            currency: "USD",
            isAvailable: true,
          },
        });
      }
    }
  }

  console.log("✅ Booking slots seeded");
  console.log("🎉 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
