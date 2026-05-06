"use client";

import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Gem, Globe, Shield, Truck } from "lucide-react";

const PROMISES = [
  {
    icon: Gem,
    title: "100% Human Hair",
    description:
      "Every strand is ethically sourced raw virgin hair — unprocessed, uncoloured, and full of life.",
  },
  {
    icon: Shield,
    title: "Quality Guaranteed",
    description:
      "We stand behind every product with a quality assurance promise and hassle-free returns.",
  },
  {
    icon: Globe,
    title: "Ships Worldwide",
    description:
      "Fast, tracked delivery to Nigeria, Ghana, UK, USA, Canada, and beyond. Always on time.",
  },
  {
    icon: Truck,
    title: "Free Shipping",
    description:
      "Complimentary shipping on all orders over $150. Because luxury shouldn't cost extra.",
  },
];

export function BrandPromise() {
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true });

  return (
    <section ref={ref} className="py-16 lg:py-24 border-b border-border-subtle">
      <div className="container-brand">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {PROMISES.map((promise, i) => {
            const Icon = promise.icon;
            return (
              <motion.div
                key={promise.title}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                className="flex flex-col items-center text-center gap-4 group"
              >
                <div className="relative w-14 h-14 rounded-2xl bg-surface-secondary flex items-center justify-center border border-border-subtle group-hover:border-brand-gold/40 transition-colors duration-300">
                  <div className="absolute inset-0 bg-gradient-gold opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300" />
                  <Icon className="w-6 h-6 text-brand-gold" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-display text-lg font-medium text-text-primary mb-1.5">
                    {promise.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {promise.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
