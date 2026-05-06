import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-surface-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
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
          </div>
          <h1 className="font-display text-3xl font-medium text-text-primary mb-2">
            Welcome back
          </h1>
          <p className="text-text-muted text-sm">
            Sign in to your account to continue
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
