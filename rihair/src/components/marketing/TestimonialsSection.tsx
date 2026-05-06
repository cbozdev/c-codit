"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { GoldDivider } from "@/components/ui/GoldDivider";
import type { Testimonial } from "@prisma/client";

type TestimonialsSectionProps = {
  testimonials: Testimonial[];
};

const FALLBACK_TESTIMONIALS = [
  {
    id: "1",
    name: "Adaeze Okonkwo",
    location: "Lagos, Nigeria",
    rating: 5,
    content:
      "Absolutely obsessed with my frontal wig from RI Hair. The HD lace is literally undetectable — everyone keeps asking if it's my real hair. Quality is 10/10 and delivery was fast!",
    avatarUrl: null,
    mediaUrl: null,
    isVideo: false,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
  },
  {
    id: "2",
    name: "Kemi Adeyemi",
    location: "Abuja, Nigeria",
    rating: 5,
    content:
      "I've been ordering from RI Hair for two years. The Brazilian body wave bundles are thick, bouncy and hold colour beautifully. Their customer service is always on point.",
    avatarUrl: null,
    mediaUrl: null,
    isVideo: false,
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(),
  },
  {
    id: "3",
    name: "Akosua Mensah",
    location: "Accra, Ghana",
    rating: 5,
    content:
      "The 28\" deep wave wig arrived in perfect condition. The install by their recommended stylist was flawless. I've never felt more confident. Worth every pesewa!",
    avatarUrl: null,
    mediaUrl: null,
    isVideo: false,
    isActive: true,
    sortOrder: 2,
    createdAt: new Date(),
  },
  {
    id: "4",
    name: "Funmi Balogun",
    location: "London, UK",
    rating: 5,
    content:
      "Ordered the Cambodian curly wig for a special event. It arrived in 3 days, pre-styled and gorgeous. The quality is truly luxury. RI Hair is my only go-to now.",
    avatarUrl: null,
    mediaUrl: null,
    isVideo: false,
    isActive: true,
    sortOrder: 3,
    createdAt: new Date(),
  },
  {
    id: "5",
    name: "Temi Williams",
    location: "Houston, USA",
    rating: 5,
    content:
      "My third purchase and every single time it exceeds expectations. The raw Indian straight bundles are incredibly soft with zero shedding. Highly recommend to every queen.",
    avatarUrl: null,
    mediaUrl: null,
    isVideo: false,
    isActive: true,
    sortOrder: 4,
    createdAt: new Date(),
  },
  {
    id: "6",
    name: "Chioma Eze",
    location: "Toronto, Canada",
    rating: 5,
    content:
      "The wig installation service was an experience. My stylist was so skilled and the result looked completely natural. Already booked my second appointment!",
    avatarUrl: null,
    mediaUrl: null,
    isVideo: false,
    isActive: true,
    sortOrder: 5,
    createdAt: new Date(),
  },
];

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const displayItems =
    testimonials.length > 0 ? testimonials : FALLBACK_TESTIMONIALS;
  const [current, setCurrent] = useState(0);
  const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true });

  const prev = () =>
    setCurrent((c) => (c - 1 + displayItems.length) % displayItems.length);
  const next = () => setCurrent((c) => (c + 1) % displayItems.length);

  const visibleCount = 3;
  const visibleItems = Array.from(
    { length: visibleCount },
    (_, i) => displayItems[(current + i) % displayItems.length]
  );

  return (
    <section
      ref={ref}
      className="py-16 lg:py-28 bg-surface-secondary overflow-hidden"
      aria-labelledby="testimonials-heading"
    >
      <div className="container-brand">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <GoldDivider label="Testimonials" className="mb-4 max-w-xs mx-auto" />
          <h2 id="testimonials-heading" className="heading-section text-text-primary mb-3">
            Loved by Thousands
          </h2>
          <p className="text-text-secondary text-base max-w-md mx-auto">
            Real queens, real results. Here&apos;s what our clients have to say
            about their RI Hair experience.
          </p>
        </motion.div>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {visibleItems.map((testimonial, i) => (
              <AnimatePresence key={`${current}-${i}`} mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="card-elevated p-6 lg:p-8 flex flex-col gap-5"
                >
                  <Quote className="w-8 h-8 text-brand-gold/40 flex-shrink-0" />
                  <p className="text-text-secondary text-sm leading-relaxed flex-1 italic">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div>
                    <StarRating rating={testimonial.rating} size="sm" />
                    <div className="mt-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center flex-shrink-0">
                        <span className="font-display font-semibold text-brand-black text-base">
                          {testimonial.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {testimonial.name}
                        </p>
                        {testimonial.location && (
                          <p className="text-xs text-text-muted">
                            {testimonial.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ))}
          </div>

          {displayItems.length > visibleCount && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={prev}
                className="btn-icon"
                aria-label="Previous testimonials"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex gap-2">
                {displayItems.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      i === current
                        ? "bg-brand-gold w-6"
                        : "bg-border-default"
                    }`}
                    aria-label={`Go to testimonial ${i + 1}`}
                    aria-current={i === current}
                  />
                ))}
              </div>
              <button
                onClick={next}
                className="btn-icon"
                aria-label="Next testimonials"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
