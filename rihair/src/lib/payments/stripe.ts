import Stripe from "stripe";
import type { PaymentInitParams, PaymentVerifyResult } from "@/types";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      typescript: true,
    });
  }
  return stripeInstance;
}

export async function createStripePaymentIntent(
  params: PaymentInitParams
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripe();

  const amountInCents = Math.round(params.amount * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: params.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      orderId: params.orderId,
      ...(params.metadata as Record<string, string>),
    },
    receipt_email: params.email,
    description: `RI Hair Collectables — Order ${params.orderId}`,
  });

  if (!paymentIntent.client_secret) {
    throw new Error("Failed to create Stripe PaymentIntent");
  }

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
}

export async function verifyStripePaymentIntent(
  paymentIntentId: string
): Promise<PaymentVerifyResult> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  return {
    success: paymentIntent.status === "succeeded",
    reference: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency.toUpperCase(),
    metadata: paymentIntent.metadata,
  };
}

export function constructStripeWebhookEvent(
  payload: string,
  signature: string
): Stripe.Event {
  const stripe = getStripe();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

export async function createStripeRefund(
  paymentIntentId: string,
  amount?: number
): Promise<string> {
  const stripe = getStripe();

  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amount ? { amount: Math.round(amount * 100) } : {}),
  });

  return refund.id;
}
