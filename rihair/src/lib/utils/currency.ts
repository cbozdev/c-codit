import { CURRENCIES, DEFAULT_CURRENCY } from "@/config/currencies";
import type { SupportedCurrency } from "@/types";

export function formatPrice(
  amount: number | null | undefined,
  currency: SupportedCurrency = DEFAULT_CURRENCY,
  options?: { compact?: boolean }
): string {
  if (amount == null) return "";

  const config = CURRENCIES[currency];

  if (options?.compact && amount >= 1000) {
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.code,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: config.fractionDigits,
    maximumFractionDigits: config.fractionDigits,
  }).format(amount);
}

export function formatDiscount(
  original: number,
  sale: number
): { amount: number; percentage: number } {
  const amount = original - sale;
  const percentage = Math.round((amount / original) * 100);
  return { amount, percentage };
}

export function convertPrice(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  rates: Record<string, number>
): number {
  if (from === to) return amount;

  const rateKey = `${from}_${to}`;
  const rate = rates[rateKey];
  if (!rate) return amount;

  return Math.round(amount * rate * 100) / 100;
}

export function parseDecimalPrice(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}
