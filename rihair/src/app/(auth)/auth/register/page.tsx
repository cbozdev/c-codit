import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create Account | RI Hair Collectables",
  description: "Join RI Hair Collectables for exclusive access to premium hair products.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-[#FAFAF8]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-gradient-to-br from-[#C9A84C] to-[#8B6914] rounded-full opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-cormorant font-bold text-[#C9A84C] text-xl">RI</span>
              </div>
            </div>
            <div>
              <span className="font-cormorant font-medium text-[#0A0A0A] text-xl leading-none block">
                RI Hair
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9A84C] leading-none">
                Collectables
              </span>
            </div>
          </div>
          <h1 className="font-cormorant text-3xl font-medium text-[#0A0A0A] mb-2">
            Create your account
          </h1>
          <p className="text-neutral-500 text-sm">
            Join thousands of customers who trust RI Hair
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
