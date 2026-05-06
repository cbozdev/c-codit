import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOrder } from "@/domains/orders/order.service";
import { checkoutSchema } from "@/validators/checkout";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const { checkout, cartItems, currency, paymentProvider, paymentReference } = body;

    const validatedCheckout = checkoutSchema.parse(checkout);

    const order = await createOrder({
      userId: session?.user?.id,
      items: cartItems,
      checkout: validatedCheckout,
      shippingAmount: 0,
      discountAmount: 0,
      taxAmount: 0,
      currency,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: paymentProvider === "stripe" ? "STRIPE" : "PAYSTACK",
        status: "COMPLETED",
        currency,
        amount: order.total,
        providerPaymentId: paymentReference,
        completedAt: new Date(),
        webhookVerified: false,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAYMENT_CONFIRMED", paidAt: new Date() },
    });

    if (session?.user?.id) {
      const loyaltyPoints = Math.floor(Number(order.total));
      const account = await prisma.loyaltyAccount.findUnique({
        where: { userId: session.user.id },
      });
      if (account) {
        await prisma.loyaltyAccount.update({
          where: { id: account.id },
          data: {
            points: { increment: loyaltyPoints },
            lifetimeEarned: { increment: loyaltyPoints },
          },
        });
        await prisma.loyaltyTransaction.create({
          data: {
            accountId: account.id,
            orderId: order.id,
            type: "EARNED_PURCHASE",
            points: loyaltyPoints,
            description: `Earned for order #${order.orderNumber}`,
          },
        });
      }
    }

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber });
  } catch (err) {
    logger.error("POST /api/orders failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create order" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "10");

    const { getCustomerOrders } = await import("@/domains/orders/order.service");
    const result = await getCustomerOrders(session.user.id, page, limit);

    return NextResponse.json(result);
  } catch (err) {
    logger.error("GET /api/orders failed", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
