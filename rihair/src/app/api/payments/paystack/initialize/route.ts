import { NextRequest, NextResponse } from "next/server";
import { initializePaystackTransaction } from "@/lib/payments/paystack";
import { logger } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["NGN", "GHS", "USD", "GBP", "CAD"]),
  email: z.string().email(),
  orderId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, currency, email, orderId } = schema.parse(body);

    const result = await initializePaystackTransaction({
      orderId: orderId ?? "pending",
      amount,
      currency,
      email,
      region: "west_africa",
    });

    return NextResponse.json(result);
  } catch (err) {
    logger.error("Paystack initialization failed", err);
    return NextResponse.json(
      { error: "Failed to initialize payment" },
      { status: 500 }
    );
  }
}
