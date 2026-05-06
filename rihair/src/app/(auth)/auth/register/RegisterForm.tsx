"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { z } from "zod";
import toast from "react-hot-toast";

const registerSchema = z
  .object({
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
    referralCode: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterInput = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("next") ?? "/dashboard";
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        referralCode: data.referralCode,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Registration failed. Please try again.");
      return;
    }

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      toast.error("Account created but sign-in failed. Please sign in manually.");
      router.push("/auth/login");
      return;
    }

    toast.success("Welcome to RI Hair! Your account is ready.");
    router.push(callbackUrl);
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    await signIn("google", { callbackUrl });
  };

  return (
    <div className="card-elevated p-8">
      <button
        type="button"
        onClick={handleGoogleSignUp}
        disabled={isGoogleLoading}
        className="w-full flex items-center justify-center gap-3 border border-neutral-200 rounded-lg py-3 px-4 text-sm font-medium text-[#0A0A0A] hover:bg-neutral-50 transition-colors mb-6 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {isGoogleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="relative flex items-center mb-6">
        <div className="flex-1 border-t border-neutral-200" />
        <span className="px-3 text-xs text-neutral-400">OR</span>
        <div className="flex-1 border-t border-neutral-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              First name
            </label>
            <input
              {...register("firstName")}
              className="input-field"
              placeholder="Adaeze"
              autoComplete="given-name"
            />
            {errors.firstName && (
              <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">
              Last name
            </label>
            <input
              {...register("lastName")}
              className="input-field"
              placeholder="Okonkwo"
              autoComplete="family-name"
            />
            {errors.lastName && (
              <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Email address
          </label>
          <input
            {...register("email")}
            type="email"
            className="input-field"
            placeholder="you@example.com"
            autoComplete="email"
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              className="input-field pr-10"
              placeholder="Min. 8 chars, 1 uppercase, 1 number"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Confirm password
          </label>
          <input
            {...register("confirmPassword")}
            type={showPassword ? "text" : "password"}
            className="input-field"
            placeholder="Repeat your password"
            autoComplete="new-password"
          />
          {errors.confirmPassword && (
            <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Referral code{" "}
            <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            {...register("referralCode")}
            className="input-field uppercase"
            placeholder="ENTER CODE"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full justify-center mt-2"
        >
          <UserPlus className="w-4 h-4" />
          {isSubmitting ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="text-center text-sm text-neutral-500 mt-6">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="text-[#C9A84C] font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-neutral-400 mt-4">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline">Terms</Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
