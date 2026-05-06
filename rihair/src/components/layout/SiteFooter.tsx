import Link from "next/link";
import {
  Instagram,
  Youtube,
  MessageCircle,
  Mail,
  MapPin,
  Phone,
  ArrowRight,
} from "lucide-react";
import { GoldDivider } from "@/components/ui/GoldDivider";
import { Button } from "@/components/ui/Button";

const PRODUCT_LINKS = [
  { label: "Human Hair Wigs", href: "/shop?category=human-hair-wigs" },
  { label: "Frontal Wigs", href: "/shop?category=frontal-wigs" },
  { label: "Closure Wigs", href: "/shop?category=closure-wigs" },
  { label: "Hair Bundles", href: "/shop?category=hair-bundles" },
  { label: "Raw Virgin Hair", href: "/shop?category=raw-virgin-hair" },
  { label: "Hair Accessories", href: "/shop?category=hair-accessories" },
  { label: "Custom Wigs", href: "/shop?category=custom-wigs" },
];

const SERVICE_LINKS = [
  { label: "Wig Installation", href: "/booking?service=WIG_INSTALLATION" },
  { label: "Hair Consultation", href: "/booking?service=HAIR_CONSULTATION" },
  { label: "Custom Wig Creation", href: "/booking?service=CUSTOM_WIG_CREATION" },
  { label: "Wig Customisation", href: "/booking?service=WIG_CUSTOMIZATION" },
  { label: "Colour Service", href: "/booking?service=COLOR_SERVICE" },
];

const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "/faq" },
  { label: "Careers", href: "/careers" },
];

const POLICY_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Returns & Refunds", href: "/returns" },
  { label: "Cookie Policy", href: "/cookies" },
];

export function SiteFooter() {
  const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, "")}`;

  return (
    <footer className="bg-surface-secondary border-t border-border-subtle mt-auto">
      {/* Newsletter */}
      <div className="border-b border-border-subtle">
        <div className="container-brand py-12 lg:py-16">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-label mb-3">Stay in the loop</p>
            <h2 className="font-display text-3xl lg:text-4xl font-medium text-text-primary mb-3">
              Be the first to know
            </h2>
            <p className="text-text-secondary text-sm mb-8">
              New arrivals, exclusive offers, style inspiration, and early access
              to limited edition collections.
            </p>
            <form
              action="/api/newsletter"
              method="POST"
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="email"
                name="email"
                placeholder="Your email address"
                required
                className="input-field flex-1"
                aria-label="Email address for newsletter"
              />
              <Button type="submit" variant="primary" size="md" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right">
                Subscribe
              </Button>
            </form>
            <p className="text-2xs text-text-muted mt-3">
              No spam. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container-brand py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-5 group">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 bg-gradient-gold rounded-full opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display font-bold text-brand-gold text-xl">RI</span>
                </div>
              </div>
              <div>
                <span className="font-display font-medium text-text-primary text-xl leading-none block">
                  RI Hair
                </span>
                <span className="text-2xs font-semibold uppercase tracking-[0.2em] text-brand-gold leading-none">
                  Collectables
                </span>
              </div>
            </Link>

            <p className="text-sm text-text-secondary mb-6 max-w-xs leading-relaxed">
              Premium luxury hair for the woman who deserves the finest. Sourced
              globally, crafted with precision, delivered worldwide.
            </p>

            <div className="space-y-2.5 mb-8">
              <a
                href={`mailto:${process.env.EMAIL_REPLY_TO ?? "support@rihaircollectables.com"}`}
                className="flex items-center gap-2.5 text-sm text-text-secondary hover:text-brand-gold transition-colors group"
              >
                <Mail className="w-4 h-4 text-brand-gold flex-shrink-0" />
                support@rihaircollectables.com
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-text-secondary hover:text-brand-gold transition-colors group"
              >
                <Phone className="w-4 h-4 text-brand-gold flex-shrink-0" />
                WhatsApp Support
              </a>
              <p className="flex items-start gap-2.5 text-sm text-text-secondary">
                <MapPin className="w-4 h-4 text-brand-gold flex-shrink-0 mt-0.5" />
                Lagos, Nigeria · London, UK
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://instagram.com/rihaircollectables"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                aria-label="Follow us on Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com/@rihaircollectables"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                aria-label="Subscribe on YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                aria-label="Chat on WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Shop</h3>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-brand-gold transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Services</h3>
            <ul className="space-y-2.5">
              {SERVICE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-brand-gold transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Company</h3>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-secondary hover:text-brand-gold transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border-subtle">
        <div className="container-brand py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted text-center md:text-left">
            © {new Date().getFullYear()} RI Hair Collectables. All rights reserved.
          </p>

          <div className="flex items-center gap-6">
            {POLICY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Payments:</span>
            {["Visa", "MC", "Amex", "Paystack", "Stripe"].map((p) => (
              <span
                key={p}
                className="text-2xs font-semibold text-text-muted border border-border-subtle rounded px-1.5 py-0.5"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
