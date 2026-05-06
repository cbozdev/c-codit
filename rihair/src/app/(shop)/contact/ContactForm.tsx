"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import toast from "react-hot-toast";
import { useState } from "react";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().min(3),
  message: z.string().min(10),
});

type FormInput = z.infer<typeof schema>;

export function ContactForm() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormInput) => {
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      toast.error("Failed to send message. Please try again.");
      return;
    }

    setSent(true);
    reset();
    toast.success("Message sent! We'll be in touch shortly.");
  };

  if (sent) {
    return (
      <div className="card-elevated p-8 flex items-center justify-center text-center">
        <div>
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Send className="w-7 h-7 text-green-600" />
          </div>
          <h3 className="font-cormorant text-2xl font-semibold text-[#0A0A0A] mb-2">
            Message received!
          </h3>
          <p className="text-neutral-500 text-sm">
            We&apos;ll get back to you within a few hours during business hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-8">
      <h2 className="font-cormorant text-2xl font-semibold text-[#0A0A0A] mb-6">
        Send us a message
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">Full name</label>
          <input {...register("name")} className="input-field" placeholder="Your name" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">Email</label>
          <input {...register("email")} type="email" className="input-field" placeholder="you@example.com" />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">Subject</label>
          <input {...register("subject")} className="input-field" placeholder="How can we help?" />
          {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">Message</label>
          <textarea
            {...register("message")}
            rows={5}
            className="input-field resize-none"
            placeholder="Tell us more about your enquiry…"
          />
          {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center">
          <Send className="w-4 h-4" />
          {isSubmitting ? "Sending…" : "Send Message"}
        </button>
      </form>
    </div>
  );
}
