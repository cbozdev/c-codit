"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Calendar, Scissors, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SERVICES = [
  {
    icon: Scissors,
    title: "Wig Installation",
    description: "Professional install by expert stylists",
    duration: "2 hrs",
    href: "/booking?service=WIG_INSTALLATION",
  },
  {
    icon: Sparkles,
    title: "Hair Consultation",
    description: "Find your perfect hair solution",
    duration: "45 min",
    href: "/booking?service=HAIR_CONSULTATION",
  },
  {
    icon: Calendar,
    title: "Custom Wig",
    description: "Bespoke creation to your exact spec",
    duration: "3 hrs",
    href: "/booking?service=CUSTOM_WIG_CREATION",
  },
];

export function BookingCTA() {
  const { ref, inView } = useInView({ threshold: 0.15, triggerOnce: true });

  return (
    <section
      ref={ref}
      className="py-16 lg:py-28 relative overflow-hidden"
      aria-labelledby="booking-cta-heading"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 via-transparent to-transparent pointer-events-none" />

      <div className="container-brand relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <span className="text-label mb-3 block">Professional Services</span>
            <h2 id="booking-cta-heading" className="heading-section text-text-primary mb-4">
              Book Your Appointment
            </h2>
            <p className="text-text-secondary text-base max-w-lg mx-auto">
              Our expert stylists are ready to transform your look. From
              installations to full custom creations — we do it all.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {SERVICES.map((service, i) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 24 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                >
                  <Link
                    href={service.href}
                    className="card-elevated p-6 flex flex-col gap-4 group hover:border-brand-gold/30 transition-colors duration-300 cursor-pointer block"
                  >
                    <div className="w-12 h-12 rounded-xl bg-brand-gold/10 flex items-center justify-center group-hover:bg-brand-gold/20 transition-colors duration-300">
                      <Icon className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-medium text-text-primary mb-1 group-hover:text-brand-gold transition-colors duration-200">
                        {service.title}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        {service.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border-subtle">
                      <span className="text-xs text-text-muted">
                        {service.duration}
                      </span>
                      <span className="text-brand-gold flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all duration-200">
                        Book <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center"
          >
            <Button
              variant="primary"
              size="lg"
              icon={<Calendar className="w-5 h-5" />}
            >
              <Link href="/booking">View All Services & Book Now</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
