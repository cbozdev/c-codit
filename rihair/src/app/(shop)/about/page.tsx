import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us | RI Hair Collectables",
  description:
    "RI Hair Collectables — your destination for premium 100% human hair wigs, bundles, and bespoke wig services.",
  openGraph: {
    title: "About RI Hair Collectables",
    description: "Premium human hair. Curated with love.",
  },
};

const VALUES = [
  {
    title: "Authenticity",
    desc: "Every strand we sell is 100% raw human hair, ethically sourced and cuticle-aligned. No blends, no compromises.",
  },
  {
    title: "Excellence",
    desc: "From HD lace that melts into every skin tone to hand-knotted custom wigs — we obsess over every detail.",
  },
  {
    title: "Community",
    desc: "We celebrate Black excellence and the beauty traditions of Africa, the UK, and the global diaspora.",
  },
  {
    title: "Trust",
    desc: "Over 5,000 customers across Nigeria, Ghana, the UK, USA and Canada trust us with their most important looks.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-[#FAFAF8]">
      {/* Hero */}
      <section className="relative h-[50vh] min-h-[400px] bg-[#0A0A0A] flex items-center justify-center text-center text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0A0A0A]/60" />
        <div className="relative z-10 container-brand max-w-2xl">
          <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-4">
            Our Story
          </p>
          <h1 className="font-cormorant text-5xl md:text-6xl font-semibold leading-tight mb-4">
            Hair as an Art Form
          </h1>
          <p className="text-white/70 text-lg">
            RI Hair Collectables was born from a passion for flawless hair and a desire to make
            luxury accessible to women everywhere.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="container-brand max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-3">
                How It Started
              </p>
              <h2 className="font-cormorant text-3xl font-semibold text-[#0A0A0A] mb-5 leading-snug">
                From a single wig to a global luxury brand
              </h2>
              <div className="space-y-4 text-neutral-600 leading-relaxed">
                <p>
                  RI Hair Collectables started as a personal quest — our founder could never find
                  wigs that looked genuinely natural, felt luxurious, and lasted longer than a few
                  months. So she went directly to the source.
                </p>
                <p>
                  After years of sourcing raw human hair from Brazil, Peru, Cambodia, and India,
                  and working with skilled artisans to craft wigs with HD lace that truly
                  disappears, RI Hair Collectables was established.
                </p>
                <p>
                  Today we serve thousands of customers in Nigeria, Ghana, the UK, USA, and Canada
                  — all with one promise: hair that makes you look in the mirror and say,{" "}
                  <em>&ldquo;That&rsquo;s me.&rdquo;</em>
                </p>
              </div>
            </div>
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-200">
              <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C]/10 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-cormorant text-4xl font-semibold text-[#C9A84C]/30">
                  RI Hair
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-[#0A0A0A]">
        <div className="container-brand max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-[0.3em] mb-3">
              What We Stand For
            </p>
            <h2 className="font-cormorant text-4xl font-semibold text-white">Our Values</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {VALUES.map((v) => (
              <div key={v.title} className="border border-white/10 rounded-xl p-7">
                <h3 className="font-cormorant text-xl font-semibold text-[#C9A84C] mb-3">
                  {v.title}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <div className="container-brand max-w-xl">
          <h2 className="font-cormorant text-4xl font-semibold text-[#0A0A0A] mb-4">
            Ready to find your signature look?
          </h2>
          <p className="text-neutral-500 mb-8">
            Browse our full collection of premium wigs and bundles, or book a bespoke
            consultation.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/shop" className="btn-primary">
              Shop Collection
            </Link>
            <Link href="/booking" className="btn-secondary">
              Book Appointment
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
