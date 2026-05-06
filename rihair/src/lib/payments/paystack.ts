import crypto from "crypto";
import { logger } from "@/lib/logger";
import type { PaymentInitParams, PaymentVerifyResult } from "@/types";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

async function paystackRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paystack API error ${response.status}: ${error}`);
  }

  return response.json() as Promise<T>;
}

export async function initializePaystackTransaction(
  params: PaymentInitParams
): Promise<{ authorizationUrl: string; reference: string; accessCode: string }> {
  const reference = `RH-PS-${params.orderId}-${Date.now()}`;

  const amountInKoboOrPesewas = Math.round(params.amount * 100);

  const result = await paystackRequest<{
    status: boolean;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: amountInKoboOrPesewas,
      currency: params.currency,
      reference,
      metadata: {
        orderId: params.orderId,
        ...params.metadata,
      },
      channels: ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer"],
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/verify`,
    }),
  });

  if (!result.status) {
    throw new Error("Failed to initialize Paystack transaction");
  }

  return {
    authorizationUrl: result.data.authorization_url,
    reference: result.data.reference,
    accessCode: result.data.access_code,
  };
}

export async function verifyPaystackTransaction(
  reference: string
): Promise<PaymentVerifyResult> {
  const result = await paystackRequest<{
    status: boolean;
    data: {
      status: string;
      reference: string;
      amount: number;
      currency: string;
      metadata?: Record<string, unknown>;
    };
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);

  const isSuccess = result.status && result.data.status === "success";

  return {
    success: isSuccess,
    reference: result.data.reference,
    amount: result.data.amount / 100,
    currency: result.data.currency,
    metadata: result.data.metadata,
  };
}

export function verifyPaystackWebhook(
  payload: string,
  signature: string
): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("PAYSTACK_WEBHOOK_SECRET is not configured");
    return false;
  }

  const hash = crypto
    .createHmac("sha512", secret)
    .update(payload)
    .digest("hex");

  return hash === signature;
}
