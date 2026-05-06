import type { Metadata } from "next";
import { FaqAccordion } from "./FaqAccordion";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ | RI Hair Collectables",
  description: "Frequently asked questions about RI Hair Collectables — hair quality, shipping, returns, payments, and more.",
};

const FAQS = [
  {
    category: "Products",
    items: [
      {
        q: "Is all your hair 100% human hair?",
        a: "Yes. Every product we sell is 100% raw or virgin human hair — no synthetic blends, no fillers. Hair is cuticle-aligned and sourced from single donors for consistent quality.",
      },
      {
        q: "What is the difference between raw and virgin hair?",
        a: "Raw hair is unprocessed hair collected directly from a single donor and has never been chemically treated. Virgin hair may have been collected from multiple donors but has also never been chemically processed. Raw hair generally lasts longer and has a more natural texture.",
      },
      {
        q: "Can I dye or bleach the hair?",
        a: "Yes! All our hair can be coloured, bleached, and heat-styled. We recommend doing a strand test first and using a professional colourist for bleaching to maintain longevity.",
      },
      {
        q: "How long do your wigs and bundles last?",
        a: "With proper care, our wigs last 1–3 years and bundles can last even longer. We recommend washing every 2–4 weeks, using silk pillowcases, and storing properly when not worn.",
      },
      {
        q: "What density should I choose?",
        a: "150% is a natural, everyday fullness — great for beginners. 180% gives a fuller, more glamorous look. 250% is extra thick and voluminous, suited for special occasions.",
      },
    ],
  },
  {
    category: "Shipping",
    items: [
      {
        q: "Which countries do you ship to?",
        a: "We currently ship to Nigeria, Ghana, the United Kingdom, the United States, and Canada. We're expanding — contact us if you're in another country.",
      },
      {
        q: "How long does shipping take?",
        a: "Nigeria: 2–5 days standard, 1–2 days express. Ghana: 3–7 days. UK: 5–10 days standard, 2–4 days express. USA & Canada: 7–14 days standard, 3–5 days express.",
      },
      {
        q: "Do you provide tracking?",
        a: "Yes. You'll receive a tracking number via email once your order is dispatched. You can also track it from your account dashboard.",
      },
      {
        q: "Is shipping insured?",
        a: "All international shipments are insured. If your package is lost or damaged in transit, we will replace it at no cost.",
      },
    ],
  },
  {
    category: "Payments",
    items: [
      {
        q: "What payment methods do you accept?",
        a: "West African customers (Nigeria, Ghana) can pay via Paystack — supporting cards, bank transfers, and mobile money. International customers (UK, USA, Canada) pay via Stripe, accepting all major credit and debit cards.",
      },
      {
        q: "Is payment secure?",
        a: "Absolutely. We use PCI-DSS compliant payment processors (Paystack and Stripe). We never store your card details on our servers.",
      },
      {
        q: "Which currencies can I pay in?",
        a: "We accept NGN, GHS, USD, GBP, and CAD. Your local currency is detected automatically, and you can switch currencies at any time using the selector in the header.",
      },
    ],
  },
  {
    category: "Returns & Refunds",
    items: [
      {
        q: "What is your return policy?",
        a: "We accept returns within 14 days of delivery for unworn, unwashed items in their original packaging. Custom wigs and items marked as final sale are non-returnable.",
      },
      {
        q: "How do I start a return?",
        a: "Email us at returns@rihaircollectables.com with your order number and reason for return. We'll provide a return label within 24 hours.",
      },
      {
        q: "When do I receive my refund?",
        a: "Once we receive and inspect your return, refunds are processed within 3–5 business days to your original payment method.",
      },
    ],
  },
  {
    category: "Bookings",
    items: [
      {
        q: "What services do you offer in-person?",
        a: "We offer Wig Installation (2 hours), Hair Consultations (45 minutes), and Custom Wig Creation (3 hours). All appointments are in Lagos, Nigeria.",
      },
      {
        q: "How do I book an appointment?",
        a: "Visit our Booking page, select your service, choose a date and time slot, and complete your details. You'll receive an email confirmation instantly.",
      },
      {
        q: "Can I reschedule?",
        a: "Yes — rescheduling is free up to 24 hours before your appointment. Contact us via WhatsApp or email to reschedule.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="bg-[#FAFAF8] py-20">
      <div className="container-brand max-w-3xl">
        <div className="text-center mb-14">
          <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-3">
            Help Centre
          </p>
          <h1 className="font-cormorant text-5xl font-semibold text-[#0A0A0A] mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-neutral-500">
            Can&apos;t find your answer? Reach out on{" "}
            <a
              href={`https://wa.me/${(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "")}`}
              className="text-[#C9A84C] hover:underline"
            >
              WhatsApp
            </a>{" "}
            or{" "}
            <Link href="/contact" className="text-[#C9A84C] hover:underline">
              send us a message
            </Link>
            .
          </p>
        </div>

        <FaqAccordion faqs={FAQS} />
      </div>
    </div>
  );
}
