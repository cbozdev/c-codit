"use client";

import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import { ProductCard } from "@/components/ui/ProductCard";
import { GoldDivider } from "@/components/ui/GoldDivider";
import type { ProductCardData } from "@/types";

type RelatedProductsProps = {
  products: ProductCardData[];
};

export function RelatedProducts({ products }: RelatedProductsProps) {
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });

  if (products.length === 0) return null;

  return (
    <section
      ref={ref}
      className="bg-surface-secondary border-t border-border-subtle py-16 lg:py-24"
    >
      <div className="container-brand">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <GoldDivider label="You May Also Like" className="mb-4 max-w-xs" />
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 2} />
          ))}
        </div>
      </div>
    </section>
  );
}
