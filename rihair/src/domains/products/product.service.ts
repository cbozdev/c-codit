import { prisma } from "@/lib/db/prisma";
import { cacheGet, cacheSet, CACHE_KEYS, CACHE_TTL } from "@/lib/cache/redis";
import type { ProductFilterInput } from "@/validators/product";
import type { PaginatedResponse, ProductCardData, ProductWithRelations } from "@/types";
import type { Prisma } from "@prisma/client";

export async function getProducts(
  filters: ProductFilterInput
): Promise<PaginatedResponse<ProductCardData>> {
  const cacheKey = CACHE_KEYS.products(JSON.stringify(filters));
  const cached = await cacheGet<PaginatedResponse<ProductCardData>>(cacheKey);
  if (cached) return cached;

  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    ...(filters.category && {
      category: { slug: filters.category },
    }),
    ...(filters.origin && { hairOrigin: filters.origin }),
    ...(filters.texture && { hairTexture: filters.texture }),
    ...(filters.laceType && { laceType: filters.laceType }),
    ...(filters.minPrice != null || filters.maxPrice != null
      ? {
          basePrice: {
            ...(filters.minPrice != null ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice != null ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
    ...(filters.minLength != null || filters.maxLength != null
      ? {
          variants: {
            some: {
              ...(filters.minLength != null
                ? { lengthInches: { gte: filters.minLength } }
                : {}),
              ...(filters.maxLength != null
                ? { lengthInches: { lte: filters.maxLength } }
                : {}),
            },
          },
        }
      : {}),
    ...(filters.q && {
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        { tags: { has: filters.q.toLowerCase() } },
      ],
    }),
  };

  const orderBy = buildOrderBy(filters.sort);

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        slug: true,
        name: true,
        basePrice: true,
        compareAtPrice: true,
        currency: true,
        hairOrigin: true,
        hairTexture: true,
        laceType: true,
        averageRating: true,
        reviewCount: true,
        isBestSeller: true,
        isNewArrival: true,
        isOnSale: true,
        isFeatured: true,
        category: { select: { name: true, slug: true } },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, altText: true },
        },
        variants: {
          where: { isAvailable: true },
          select: {
            id: true,
            lengthInches: true,
            density: true,
            price: true,
            stockQuantity: true,
            color: true,
          },
          orderBy: { price: "asc" },
        },
      },
    }),
  ]);

  const formatted: ProductCardData[] = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice,
    currency: p.currency,
    hairOrigin: p.hairOrigin,
    hairTexture: p.hairTexture,
    laceType: p.laceType,
    averageRating: p.averageRating,
    reviewCount: p.reviewCount,
    isBestSeller: p.isBestSeller,
    isNewArrival: p.isNewArrival,
    isOnSale: p.isOnSale,
    isFeatured: p.isFeatured,
    primaryImage: p.images[0]?.url ?? null,
    category: p.category,
    variants: p.variants,
  }));

  const totalPages = Math.ceil(total / filters.limit);
  const result: PaginatedResponse<ProductCardData> = {
    data: formatted,
    meta: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
      hasNextPage: filters.page < totalPages,
      hasPrevPage: filters.page > 1,
    },
  };

  await cacheSet(cacheKey, result, CACHE_TTL.products);
  return result;
}

export async function getProductBySlug(
  slug: string
): Promise<ProductWithRelations | null> {
  const cacheKey = CACHE_KEYS.product(slug);
  const cached = await cacheGet<ProductWithRelations>(cacheKey);
  if (cached) return cached;

  const product = await prisma.product.findUnique({
    where: { slug, status: "ACTIVE" },
    include: {
      category: true,
      variants: {
        orderBy: [{ lengthInches: "asc" }, { price: "asc" }],
      },
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      },
    },
  });

  if (product) {
    await Promise.all([
      cacheSet(cacheKey, product, CACHE_TTL.product),
      prisma.product.update({
        where: { id: product.id },
        data: { viewCount: { increment: 1 } },
      }),
    ]);
  }

  return product;
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", isFeatured: true },
    take: limit,
    orderBy: { purchaseCount: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      basePrice: true,
      compareAtPrice: true,
      currency: true,
      hairOrigin: true,
      hairTexture: true,
      laceType: true,
      averageRating: true,
      reviewCount: true,
      isBestSeller: true,
      isNewArrival: true,
      isOnSale: true,
      isFeatured: true,
      category: { select: { name: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
      variants: {
        where: { isAvailable: true, stockQuantity: { gt: 0 } },
        select: {
          id: true,
          lengthInches: true,
          density: true,
          price: true,
          stockQuantity: true,
          color: true,
        },
        orderBy: { price: "asc" },
        take: 6,
      },
    },
  });

  return products.map((p) => ({
    ...p,
    primaryImage: p.images[0]?.url ?? null,
  }));
}

export async function getBestSellers(limit = 8): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", isBestSeller: true },
    take: limit,
    orderBy: { purchaseCount: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      basePrice: true,
      compareAtPrice: true,
      currency: true,
      hairOrigin: true,
      hairTexture: true,
      laceType: true,
      averageRating: true,
      reviewCount: true,
      isBestSeller: true,
      isNewArrival: true,
      isOnSale: true,
      isFeatured: true,
      category: { select: { name: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
      variants: {
        where: { isAvailable: true, stockQuantity: { gt: 0 } },
        select: {
          id: true,
          lengthInches: true,
          density: true,
          price: true,
          stockQuantity: true,
          color: true,
        },
        orderBy: { price: "asc" },
        take: 6,
      },
    },
  });

  return products.map((p) => ({
    ...p,
    primaryImage: p.images[0]?.url ?? null,
  }));
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4
): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      categoryId,
      id: { not: productId },
    },
    take: limit,
    orderBy: { purchaseCount: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      basePrice: true,
      compareAtPrice: true,
      currency: true,
      hairOrigin: true,
      hairTexture: true,
      laceType: true,
      averageRating: true,
      reviewCount: true,
      isBestSeller: true,
      isNewArrival: true,
      isOnSale: true,
      isFeatured: true,
      category: { select: { name: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
      variants: {
        where: { isAvailable: true, stockQuantity: { gt: 0 } },
        select: {
          id: true,
          lengthInches: true,
          density: true,
          price: true,
          stockQuantity: true,
          color: true,
        },
        orderBy: { price: "asc" },
        take: 6,
      },
    },
  });

  return products.map((p) => ({
    ...p,
    primaryImage: p.images[0]?.url ?? null,
  }));
}

function buildOrderBy(sort: string): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { basePrice: "asc" };
    case "price_desc":
      return { basePrice: "desc" };
    case "popular":
      return { purchaseCount: "desc" };
    case "rating":
      return { averageRating: "desc" };
    case "featured":
      return { isFeatured: "desc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}
