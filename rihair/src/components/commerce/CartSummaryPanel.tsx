"use client";

import { useState } from "react";
import Image from "next/image";
import { Tag, X } from "lucide-react";
import { formatPrice } from "@/lib/utils/currency";
import { Button } from "@/components/ui/Button";
import { useCartStore } from "@/stores/cart.store";
import type { CartSummary, SupportedCurrency } from "@/types";
import toast from "react-hot-toast";

type CartSummaryPanelProps = {
  summary: CartSummary;
  currency: SupportedCurrency;
  couponCode: string | null;
};

export function CartSummaryPanel({
  summary,
  currency,
  couponCode,
}: CartSummaryPanelProps) {
  const { applyCoupon, removeCoupon } = useCartStore();
  const [inputCode, setInputCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const handleApplyCoupon = async () => {
    if (!inputCode.trim()) return;
    setIsApplying(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inputCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid coupon code");
      applyCoupon(data.code, data.discountAmount);
      setInputCode("");
      toast.success(`Coupon applied: ${data.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid coupon");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="card-elevated p-5 space-y-5 sticky top-28">
      <h3 className="font-display text-lg font-medium text-text-primary">
        Order Summary
      </h3>

      {/* Items */}
      <ul className="space-y-3 max-h-60 overflow-y-auto scrollbar-thin pr-1">
        {summary.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <div className="relative w-12 h-14 rounded-lg bg-surface-tertiary flex-shrink-0 overflow-hidden">
              {item.product.primaryImage && (
                <Image
                  src={item.product.primaryImage}
                  alt={item.product.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              )}
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-surface-tertiary border border-border-default rounded-full text-2xs font-bold text-text-primary flex items-center justify-center">
                {item.quantity}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{item.product.name}</p>
              {item.variant && (
                <p className="text-2xs text-text-muted truncate">
                  {[
                    item.variant.lengthInches && `${item.variant.lengthInches}"`,
                    item.variant.density?.replace("DENSITY_", "") + "%",
                    item.variant.color,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <span className="text-sm font-medium text-text-primary flex-shrink-0">
              {formatPrice(item.lineTotal, currency)}
            </span>
          </li>
        ))}
      </ul>

      {/* Coupon */}
      <div>
        {couponCode ? (
          <div className="flex items-center justify-between bg-brand-gold/10 border border-brand-gold/30 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-brand-gold" />
              <span className="text-sm font-semibold text-brand-gold">{couponCode}</span>
            </div>
            <button
              onClick={() => removeCoupon()}
              className="text-text-muted hover:text-feedback-error transition-colors"
              aria-label="Remove coupon"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              className="input-field flex-1 py-2.5 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleApplyCoupon}
              loading={isApplying}
              disabled={!inputCode.trim()}
            >
              Apply
            </Button>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="space-y-2.5 border-t border-border-subtle pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Subtotal</span>
          <span className="text-text-secondary">
            {formatPrice(summary.subtotal, currency)}
          </span>
        </div>
        {summary.discount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-emerald-400">Discount</span>
            <span className="text-emerald-400">
              −{formatPrice(summary.discount, currency)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Shipping</span>
          <span className="text-text-secondary">
            {summary.shipping === 0
              ? "Free"
              : formatPrice(summary.shipping, currency)}
          </span>
        </div>
        {summary.tax > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-text-muted">Tax</span>
            <span className="text-text-secondary">
              {formatPrice(summary.tax, currency)}
            </span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-border-subtle">
          <span className="font-semibold text-text-primary">Total</span>
          <span className="font-bold text-text-primary text-lg">
            {formatPrice(summary.total, currency)}
          </span>
        </div>
      </div>
    </div>
  );
}
