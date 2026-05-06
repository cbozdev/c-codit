import { NextRequest, NextResponse } from "next/server";
import { constructStripeWebhookEvent } from "@/lib/payments/stripe";
import { updateOrderStatus } from "@/domains/orders/order.service";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = constructStripeWebhookEvent(payload, signature);
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const orderId = pi.metadata?.["orderId"];
        if (orderId) {
          await prisma.payment.updateMany({
            where: { providerPaymentId: pi.id },
            data: { status: "COMPLETED", webhookVerified: true, completedAt: new Date() },
          });
          await updateOrderStatus(orderId, "PAYMENT_CONFIRMED", "Payment confirmed via Stripe webhook");
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const orderId = pi.metadata?.["orderId"];
        if (orderId) {
          await prisma.payment.updateMany({
            where: { providerPaymentId: pi.id },
            data: {
              status: "FAILED",
              failureCode: pi.last_payment_error?.code ?? null,
              failureMessage: pi.last_payment_error?.message ?? null,
            },
          });
          await updateOrderStatus(orderId, "CANCELLED", "Payment failed");
        }
        break;
      }
      case "charge.dispute.created": {
        const dispute = event.data.object;
        await prisma.fraudLog.create({
          data: {
            eventType: "chargeback",
            description: `Stripe dispute created: ${dispute.id}`,
            metadata: { disputeId: dispute.id, amount: dispute.amount, reason: dispute.reason },
          },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("Stripe webhook processing failed", err, { eventType: event.type });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
