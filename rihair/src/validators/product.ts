import { z } from "zod";

export const productFilterSchema = z.object({
  category: z.string().optional(),
  origin: z
    .enum(["BRAZILIAN", "PERUVIAN", "CAMBODIAN", "INDIAN", "MALAYSIAN", "BURMESE"])
    .optional(),
  texture: z
    .enum([
      "STRAIGHT",
      "BODY_WAVE",
      "CURLY",
      "DEEP_WAVE",
      "WATER_WAVE",
      "LOOSE_WAVE",
      "KINKY_CURLY",
      "YAKI_STRAIGHT",
    ])
    .optional(),
  laceType: z
    .enum([
      "HD_LACE",
      "TRANSPARENT_LACE",
      "BROWN_LACE",
      "SWISS_LACE",
      "FULL_LACE",
    ])
    .optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minLength: z.coerce.number().min(10).max(40).optional(),
  maxLength: z.coerce.number().min(10).max(40).optional(),
  density: z
    .enum([
      "DENSITY_130",
      "DENSITY_150",
      "DENSITY_180",
      "DENSITY_200",
      "DENSITY_250",
    ])
    .optional(),
  sort: z
    .enum([
      "newest",
      "price_asc",
      "price_desc",
      "popular",
      "rating",
      "featured",
    ])
    .default("newest"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(24),
  q: z.string().max(200).optional(),
});

export const createProductSchema = z.object({
  name: z.string().min(3, "Product name must be at least 3 characters").max(200),
  shortDescription: z.string().max(500).optional(),
  description: z.string().min(20, "Description must be at least 20 characters"),
  categoryId: z.string().cuid("Invalid category"),
  hairOrigin: z
    .enum(["BRAZILIAN", "PERUVIAN", "CAMBODIAN", "INDIAN", "MALAYSIAN", "BURMESE"])
    .optional(),
  hairTexture: z
    .enum([
      "STRAIGHT",
      "BODY_WAVE",
      "CURLY",
      "DEEP_WAVE",
      "WATER_WAVE",
      "LOOSE_WAVE",
      "KINKY_CURLY",
      "YAKI_STRAIGHT",
    ])
    .optional(),
  laceType: z
    .enum([
      "HD_LACE",
      "TRANSPARENT_LACE",
      "BROWN_LACE",
      "SWISS_LACE",
      "FULL_LACE",
    ])
    .optional(),
  basePrice: z.coerce
    .number()
    .positive("Price must be greater than 0"),
  compareAtPrice: z.coerce.number().positive().optional(),
  costPrice: z.coerce.number().positive().optional(),
  currency: z.enum(["NGN", "GHS", "USD", "GBP", "CAD"]).default("USD"),
  weight: z.coerce.number().positive().optional(),
  status: z
    .enum(["DRAFT", "ACTIVE", "ARCHIVED"])
    .default("DRAFT"),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  seoTitle: z.string().max(70).optional(),
  seoDesc: z.string().max(160).optional(),
  videoUrl: z.string().url().optional().or(z.literal("")),
});

export const productVariantSchema = z.object({
  productId: z.string().cuid(),
  sku: z.string().min(1).max(100),
  lengthInches: z.coerce.number().min(10).max(40).optional(),
  density: z
    .enum([
      "DENSITY_130",
      "DENSITY_150",
      "DENSITY_180",
      "DENSITY_200",
      "DENSITY_250",
    ])
    .optional(),
  color: z.string().max(100).optional(),
  colorCode: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  price: z.coerce.number().positive(),
  compareAtPrice: z.coerce.number().positive().optional(),
  stockQuantity: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
});

export const productReviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(100).optional(),
  body: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(2000),
  mediaUrls: z.array(z.string().url()).max(5).default([]),
});

export type ProductFilterInput = z.infer<typeof productFilterSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type ProductReviewInput = z.infer<typeof productReviewSchema>;
