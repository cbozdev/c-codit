import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";
import { Mail, MessageCircle, MapPin, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us | RI Hair Collectables",
  description: "Get in touch with RI Hair Collectables. We&apos;re here to help with orders, consultations, and everything else.",
};

const CONTACT_INFO = [
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "+234 800 000 0000",
    href: `https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "")}`,
  },
  {
    icon: Mail,
    label: "Email",
    value: "hello@rihaircollectables.com",
    href: "mailto:hello@rihaircollectables.com",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "Lagos, Nigeria (appointments only)",
    href: null,
  },
  {
    icon: Clock,
    label: "Business Hours",
    value: "Mon–Fri 9am–6pm WAT",
    href: null,
  },
];

export default function ContactPage() {
  return (
    <div className="bg-[#FAFAF8] py-20">
      <div className="container-brand max-w-5xl">
        <div className="text-center mb-14">
          <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-3">
            Get In Touch
          </p>
          <h1 className="font-cormorant text-5xl font-semibold text-[#0A0A0A] mb-4">
            We&apos;d love to hear from you
          </h1>
          <p className="text-neutral-500 max-w-lg mx-auto">
            Questions about products, custom orders, shipping, or anything else? Reach out — we
            usually respond within a few hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {CONTACT_INFO.map((info) => (
                <div key={info.label} className="card-elevated p-5">
                  <info.icon className="w-5 h-5 text-[#C9A84C] mb-3" />
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    {info.label}
                  </p>
                  {info.href ? (
                    <a
                      href={info.href}
                      target={info.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      className="text-sm text-[#0A0A0A] hover:text-[#C9A84C] transition-colors"
                    >
                      {info.value}
                    </a>
                  ) : (
                    <p className="text-sm text-[#0A0A0A]">{info.value}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-[#0A0A0A] rounded-xl p-6 text-white">
              <h3 className="font-cormorant text-xl font-semibold mb-2">Quick Response via WhatsApp</h3>
              <p className="text-white/60 text-sm mb-4">
                For the fastest response, message us on WhatsApp. Include your order number or
                product inquiry and we&apos;ll get back to you straight away.
              </p>
              <a
                href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20b858] text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Chat on WhatsApp
              </a>
            </div>
          </div>

          <ContactForm />
        </div>
      </div>
    </div>
  );
}
