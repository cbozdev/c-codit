"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Plus, Trash2, Star } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import type { Address } from "@prisma/client";

const addressSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().min(7),
  addressLine1: z.string().min(5),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  postalCode: z.string().min(2),
  country: z.string().min(2),
  isDefault: z.boolean().default(false),
});

type AddressInput = z.infer<typeof addressSchema>;

export function AddressesView({ addresses, userId }: { addresses: Address[]; userId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressInput>({ resolver: zodResolver(addressSchema) });

  const onSubmit = async (data: AddressInput) => {
    setSaving(true);
    const res = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, userId }),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error("Failed to save address.");
      return;
    }
    toast.success("Address saved!");
    reset();
    setShowForm(false);
    router.refresh();
  };

  const deleteAddress = async (id: string) => {
    setDeleting(id);
    const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
    setDeleting(null);

    if (!res.ok) {
      toast.error("Failed to delete address.");
      return;
    }
    toast.success("Address removed.");
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {addresses.map((addr, i) => (
        <motion.div
          key={addr.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="card-elevated p-5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#C9A84C] mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-[#0A0A0A]">
                  {addr.firstName} {addr.lastName}
                </p>
                <p className="text-neutral-500">{addr.addressLine1}</p>
                {addr.addressLine2 && <p className="text-neutral-500">{addr.addressLine2}</p>}
                <p className="text-neutral-500">
                  {addr.city}, {addr.state} {addr.postalCode}
                </p>
                <p className="text-neutral-500">{addr.country}</p>
                {addr.phone && <p className="text-neutral-500">{addr.phone}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {addr.isDefault && (
                <span className="flex items-center gap-1 text-xs font-medium text-[#C9A84C]">
                  <Star className="w-3 h-3 fill-[#C9A84C]" /> Default
                </span>
              )}
              <button
                onClick={() => deleteAddress(addr.id)}
                disabled={deleting === addr.id}
                className="text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      ))}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="card-elevated p-6 overflow-hidden"
          >
            <h3 className="font-cormorant text-xl font-medium text-[#0A0A0A] mb-5">
              New Address
            </h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["firstName", "lastName"] as const).map((f) => (
                  <div key={f}>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5 capitalize">
                      {f === "firstName" ? "First name" : "Last name"}
                    </label>
                    <input {...register(f)} className="input-field" />
                    {errors[f] && <p className="text-xs text-red-500 mt-1">{errors[f]?.message}</p>}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Phone</label>
                <input {...register("phone")} className="input-field" type="tel" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Address Line 1
                </label>
                <input {...register("addressLine1")} className="input-field" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Address Line 2 (optional)
                </label>
                <input {...register("addressLine2")} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">City</label>
                  <input {...register("city")} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    State / Region
                  </label>
                  <input {...register("state")} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Postal code
                  </label>
                  <input {...register("postalCode")} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Country
                  </label>
                  <input {...register("country")} className="input-field" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                <input {...register("isDefault")} type="checkbox" className="rounded" />
                Set as default address
              </label>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? "Saving…" : "Save Address"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-secondary w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Add New Address
        </button>
      )}
    </div>
  );
}
