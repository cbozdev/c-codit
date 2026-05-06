"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { GoldDivider } from "@/components/ui/GoldDivider";
import type { ProductCardData } from "@/types";

type BestSellersSectionProps = {
  products: ProductCardData[];
};

export function BestSellersSection({ products }: BestSellersSectionProps) {
  const { ref, inView } = useInView({ threshold: 0.05, triggerOnce: true });

  if (products.length === 0) return null;

  return (
    <section
      ref={ref}
      className="py-16 lg:py-28 bg-surface-secondary"
      aria-labelledby="best-sellers-heading"
    >
      <div className="container-brand">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4"
        >
          <div>
            <GoldDivider label="Best Sellers" className="mb-4 max-w-xs" />
            <h2 id="best-sellers-heading" className="heading-section text-text-primary">
              Our Most Loved
            </h2>
          </div>
          <Link
            href="/shop?sort=popular"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold hover:gap-3 transition-all duration-200 flex-shrink-0"
          >
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {products.slice(0, 8).map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              priority={i < 4}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
