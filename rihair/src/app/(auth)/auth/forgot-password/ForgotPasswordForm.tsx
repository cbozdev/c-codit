"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormInput = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormInput>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormInput) => {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email }),
    });

    if (!res.ok) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="card-elevated p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-4">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="font-cormorant text-2xl font-medium text-[#0A0A0A] mb-2">
          Check your inbox
        </h2>
        <p className="text-neutral-500 text-sm mb-6">
          We sent a password reset link to{" "}
          <strong className="text-[#0A0A0A]">{getValues("email")}</strong>. Check your spam
          folder if you don&apos;t see it within a few minutes.
        </p>
        <Link href="/auth/login" className="btn-primary w-full justify-center">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="card-elevated p-8">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              {...register("email")}
              type="email"
              className="input-field pl-10"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full justify-center"
        >
          {isSubmitting ? "Sending…" : "Send Reset Link"}
        </button>
      </form>

      <Link
        href="/auth/login"
        className="flex items-center justify-center gap-2 text-sm text-neutral-500 hover:text-[#0A0A0A] mt-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Sign In
      </Link>
    </div>
  );
}
