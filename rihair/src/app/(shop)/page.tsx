import type { Metadata } from "next";
import { HeroSection } from "@/components/marketing/HeroSection";
import { FeaturedCollections } from "@/components/marketing/FeaturedCollections";
import { BestSellersSection } from "@/components/marketing/BestSellersSection";
import { BrandPromise } from "@/components/marketing/BrandPromise";
import { TestimonialsSection } from "@/components/marketing/TestimonialsSection";
import { InstagramFeed } from "@/components/marketing/InstagramFeed";
import { BookingCTA } from "@/components/marketing/BookingCTA";
import { getFeaturedProducts, getBestSellers } from "@/domains/products/product.service";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "RI Hair Collectables — Premium Luxury Hair",
  description:
    "Discover the finest human hair wigs, bundles & extensions. Premium Brazilian, Peruvian, Cambodian & Indian raw virgin hair. HD lace wigs. Ships to Nigeria, Ghana, UK, USA & Canada.",
};

export const revalidate = 3600;

async function getHomepageData() {
  const [featuredProducts, bestSellers, testimonials] = await Promise.all([
    getFeaturedProducts(8),
    getBestSellers(8),
    prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      take: 6,
    }),
  ]);

  return { featuredProducts, bestSellers, testimonials };
}

export default async function HomePage() {
  const { featuredProducts, bestSellers, testimonials } =
    await getHomepageData();

  return (
    <>
      <HeroSection />
      <BrandPromise />
      <FeaturedCollections />
      <BestSellersSection products={bestSellers} />
      <BookingCTA />
      <TestimonialsSection testimonials={testimonials} />
      <InstagramFeed />
    </>
  );
}
