"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import toast from "react-hot-toast";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormInput = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({ resolver: zodResolver(schema) });

  if (!token) {
    return (
      <div className="card-elevated p-8 text-center">
        <p className="text-neutral-500 mb-4">Invalid or expired reset link.</p>
        <Link href="/auth/forgot-password" className="btn-primary w-full justify-center">
          Request a new link
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: FormInput) => {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: data.password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Reset failed. The link may have expired.");
      return;
    }

    toast.success("Password updated! Please sign in.");
    router.push("/auth/login");
  };

  return (
    <div className="card-elevated p-8">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            New password
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
            Confirm new password
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full justify-center mt-2"
        >
          <KeyRound className="w-4 h-4" />
          {isSubmitting ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
