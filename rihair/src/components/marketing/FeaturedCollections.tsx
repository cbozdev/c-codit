"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ArrowRight } from "lucide-react";
import { GoldDivider } from "@/components/ui/GoldDivider";

const COLLECTIONS = [
  {
    slug: "frontal-wigs",
    name: "Frontal Wigs",
    description: "Seamless lace frontal wigs for the most natural hairline",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/samples/ecommerce/accessories-bag.jpg",
    count: "32+ styles",
    accent: "from-amber-900/40 to-brand-black",
  },
  {
    slug: "closure-wigs",
    name: "Closure Wigs",
    description: "4×4 and 5×5 closure wigs with full protective coverage",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/samples/ecommerce/shoes.png",
    count: "28+ styles",
    accent: "from-stone-900/40 to-brand-black",
  },
  {
    slug: "hair-bundles",
    name: "Hair Bundles",
    description: "Premium raw bundles in every texture and length",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/samples/ecommerce/leather-bag-gray.jpg",
    count: "40+ bundles",
    accent: "from-zinc-900/40 to-brand-black",
  },
  {
    slug: "raw-virgin-hair",
    name: "Raw Virgin Hair",
    description: "Unprocessed, cuticle-aligned raw hair from trusted origins",
    imageUrl: "https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/samples/ecommerce/car-interior-design.jpg",
    count: "20+ options",
    accent: "from-neutral-900/40 to-brand-black",
  },
];

export function FeaturedCollections() {
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <section ref={ref} className="py-16 lg:py-28">
      <div className="container-brand">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <GoldDivider label="Collections" className="mb-4 max-w-xs mx-auto" />
          <h2 className="heading-section text-text-primary mb-4">
            Crafted for Every Style
          </h2>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            From everyday elegance to show-stopping glamour — our curated
            collections have exactly what you need.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {COLLECTIONS.map((collection, i) => (
            <motion.div
              key={collection.slug}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <Link
                href={`/shop?category=${collection.slug}`}
                className="group relative flex h-64 lg:h-80 rounded-2xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              >
                <div
                  className="absolute inset-0 bg-surface-tertiary transition-transform duration-700 group-hover:scale-105"
                  style={{
                    backgroundImage: `url(${collection.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-t ${collection.accent} opacity-70 group-hover:opacity-80 transition-opacity duration-300`}
                />

                <div className="relative z-10 flex flex-col justify-end p-6 lg:p-8 w-full">
                  <p className="text-2xs text-brand-gold font-semibold uppercase tracking-widest mb-1.5">
                    {collection.count}
                  </p>
                  <h3 className="font-display text-2xl lg:text-3xl font-medium text-text-primary mb-2 group-hover:text-brand-gold transition-colors duration-300">
                    {collection.name}
                  </h3>
                  <p className="text-sm text-text-secondary mb-4 max-w-xs">
                    {collection.description}
                  </p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold group-hover:gap-3 transition-all duration-200">
                    Explore <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-gold border border-brand-gold/30 hover:border-brand-gold px-8 py-3 rounded-full transition-colors duration-200"
          >
            View All Collections <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
