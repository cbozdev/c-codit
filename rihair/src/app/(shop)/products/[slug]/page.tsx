import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/domains/products/product.service";
import { ProductDetailView } from "./ProductDetailView";
import { RelatedProducts } from "@/components/commerce/RelatedProducts";
import { prisma } from "@/lib/db/prisma";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0];

  return {
    title: product.seoTitle ?? product.name,
    description:
      product.seoDesc ??
      product.shortDescription ??
      product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.shortDescription ?? product.description.slice(0, 160),
      images: primaryImage
        ? [{ url: primaryImage.url, alt: primaryImage.altText ?? product.name }]
        : [],
    },
  };
}

export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { slug: true },
    take: 100,
  });
  return products.map((p) => ({ slug: p.slug }));
}

export const revalidate = 3600;

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const relatedProducts = await getRelatedProducts(
    product.id,
    product.categoryId
  );

  const approvedReviews = await prisma.review.findMany({
    where: { productId: product.id, status: "APPROVED" },
    include: {
      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <>
      <ProductDetailView product={product} reviews={approvedReviews} />
      <RelatedProducts products={relatedProducts} />
    </>
  );
}
