import { NextRequest, NextResponse } from "next/server";
import { verifyPaystackWebhook } from "@/lib/payments/paystack";
import { updateOrderStatus } from "@/domains/orders/order.service";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!signature || !verifyPaystackWebhook(payload, signature)) {
    logger.warn("Invalid Paystack webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { event: eventType, data } = event;

    if (eventType === "charge.success") {
      const reference: string = data.reference;
      const orderId: string | undefined = data.metadata?.orderId;

      if (orderId) {
        await prisma.payment.updateMany({
          where: { providerReference: reference },
          data: { status: "COMPLETED", webhookVerified: true, completedAt: new Date() },
        });
        await updateOrderStatus(
          orderId,
          "PAYMENT_CONFIRMED",
          "Payment confirmed via Paystack webhook"
        );
      }
    }

    if (eventType === "charge.failed") {
      const orderId: string | undefined = data.metadata?.orderId;
      if (orderId) {
        await updateOrderStatus(orderId, "CANCELLED", "Payment failed via Paystack");
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error("Paystack webhook processing failed", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
