"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { GoldAccent } from "@/components/ui/GoldDivider";

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const yBg = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const heroImages = [
    {
      url: "https://res.cloudinary.com/demo/image/upload/q_auto,f_auto/w_1920/samples/people/jazz.jpg",
      alt: "Premium HD lace wig",
    },
  ];

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      aria-label="Hero"
    >
      {/* Background */}
      <motion.div
        style={{ y: yBg }}
        className="absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 bg-gradient-hero z-10" />
        <div className="absolute inset-0 bg-surface-primary/40 z-10" />
        <div className="w-full h-full bg-gradient-dark" />
      </motion.div>

      {/* Decorative gold elements */}
      <div className="absolute top-1/4 left-8 w-px h-32 bg-gradient-to-b from-transparent via-brand-gold/40 to-transparent hidden lg:block" />
      <div className="absolute top-1/4 right-8 w-px h-32 bg-gradient-to-b from-transparent via-brand-gold/40 to-transparent hidden lg:block" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent hidden lg:block" />

      <motion.div
        style={{ opacity }}
        className="container-brand relative z-10 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <GoldAccent className="justify-center mb-6" />
          <span className="text-label">Premium Luxury Hair — Est. 2020</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="font-display font-medium text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-text-primary leading-[0.95] tracking-tight mb-6"
        >
          Your Crown,
          <br />
          <span className="text-gradient-gold italic">Perfected.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-text-secondary text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Raw virgin hair from Brazil, Peru, Cambodia & India. HD lace wigs
          crafted for flawless natural installs. Shipped worldwide.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            variant="primary"
            size="lg"
            icon={<ArrowRight className="w-5 h-5" />}
            iconPosition="right"
            className="min-w-[180px]"
          >
            <Link href="/shop">Shop the Collection</Link>
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<Play className="w-4 h-4 fill-current" />}
            className="min-w-[180px]"
          >
            <Link href="/booking">Book a Service</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-16 flex items-center justify-center gap-12 lg:gap-16"
        >
          {[
            { value: "5,000+", label: "Happy Clients" },
            { value: "100%", label: "Human Hair" },
            { value: "5★", label: "Average Rating" },
            { value: "5+", label: "Countries Served" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="font-display text-2xl lg:text-3xl font-medium text-brand-gold">
                {value}
              </p>
              <p className="text-2xs text-text-muted uppercase tracking-wider mt-1">
                {label}
              </p>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-2xs text-text-muted uppercase tracking-widest">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-px h-8 bg-gradient-to-b from-brand-gold/60 to-transparent"
        />
      </motion.div>
    </section>
  );
}
