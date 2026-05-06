import { WEST_AFRICA_COUNTRIES } from "@/config/currencies";
import type { PaymentInitParams, PaymentRegion, SupportedCurrency } from "@/types";
import { initializePaystackTransaction } from "./paystack";
import { createStripePaymentIntent } from "./stripe";

export function detectPaymentRegion(countryCode: string): PaymentRegion {
  return WEST_AFRICA_COUNTRIES.includes(countryCode.toUpperCase())
    ? "west_africa"
    : "international";
}

export function getPreferredCurrency(countryCode: string): SupportedCurrency {
  const map: Record<string, SupportedCurrency> = {
    NG: "NGN",
    GH: "GHS",
    GB: "GBP",
    US: "USD",
    CA: "CAD",
  };
  return map[countryCode.toUpperCase()] ?? "USD";
}

export async function initiatePayment(params: PaymentInitParams) {
  if (params.region === "west_africa") {
    return initializePaystackTransaction(params);
  }
  return createStripePaymentIntent(params);
}

export { initializePaystackTransaction, verifyPaystackTransaction, verifyPaystackWebhook } from "./paystack";
export { createStripePaymentIntent, verifyStripePaymentIntent, constructStripeWebhookEvent, createStripeRefund } from "./stripe";
