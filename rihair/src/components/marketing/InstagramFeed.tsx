"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Instagram } from "lucide-react";
import { GoldDivider } from "@/components/ui/GoldDivider";

const PLACEHOLDER_POSTS = Array.from({ length: 6 }, (_, i) => ({
  id: String(i),
  imageUrl: `https://res.cloudinary.com/demo/image/upload/q_auto,f_auto,w_400,h_400,c_fill/samples/food/fish-vegetables.jpg`,
  likes: Math.floor(Math.random() * 500) + 50,
  comments: Math.floor(Math.random() * 50) + 5,
}));

export function InstagramFeed() {
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });
  const instagramUrl = `https://instagram.com/${process.env.NEXT_PUBLIC_INSTAGRAM_USERNAME ?? "rihaircollectables"}`;

  return (
    <section ref={ref} className="py-16 lg:py-24 border-t border-border-subtle">
      <div className="container-brand">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4"
        >
          <div>
            <GoldDivider label="@rihaircollectables" className="mb-3 max-w-xs" />
            <h2 className="heading-card text-text-primary">
              Real Queens, Real Results
            </h2>
          </div>
          <Link
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-semibold text-brand-gold border border-brand-gold/30 hover:border-brand-gold px-6 py-2.5 rounded-full transition-colors duration-200"
          >
            <Instagram className="w-4 h-4" />
            Follow Us
          </Link>
        </motion.div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 lg:gap-3">
          {PLACEHOLDER_POSTS.map((post, i) => (
            <motion.a
              key={post.id}
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group relative aspect-square rounded-xl overflow-hidden bg-surface-tertiary block"
              aria-label={`View Instagram post ${i + 1}`}
            >
              <div
                className="absolute inset-0 bg-surface-secondary transition-transform duration-500 group-hover:scale-110"
                style={{
                  backgroundImage: `url(${post.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <Instagram className="w-6 h-6 text-white" />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
