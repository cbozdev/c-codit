import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { couponSchema } from "@/validators/checkout";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const { code } = couponSchema.parse(body);

    const coupon = await prisma.coupon.findUnique({ where: { code } });

    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ error: "Invalid or expired coupon code" }, { status: 400 });
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      return NextResponse.json({ error: "This coupon is not yet active" }, { status: 400 });
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return NextResponse.json({ error: "This coupon has expired" }, { status: 400 });
    }
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return NextResponse.json({ error: "This coupon has reached its usage limit" }, { status: 400 });
    }

    if (session?.user && coupon.usageLimitPerUser) {
      const userUsages = await prisma.couponUsage.count({
        where: { couponId: coupon.id, userId: session.user.id },
      });
      if (userUsages >= coupon.usageLimitPerUser) {
        return NextResponse.json(
          { error: "You have already used this coupon the maximum number of times" },
          { status: 400 }
        );
      }
    }

    const discountAmount =
      coupon.type === "FIXED_AMOUNT"
        ? Number(coupon.value)
        : coupon.type === "FREE_SHIPPING"
        ? 0
        : null;

    return NextResponse.json({
      code: coupon.code,
      type: coupon.type,
      value: Number(coupon.value),
      discountAmount: discountAmount ?? Number(coupon.value),
      minOrderAmount: coupon.minOrderAmount ? Number(coupon.minOrderAmount) : null,
    });
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
