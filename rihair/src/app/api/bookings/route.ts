import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { bookingSchema } from "@/validators/booking";
import { generateBookingRef } from "@/lib/utils/slug";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "You must be signed in to book" }, { status: 401 });
    }

    const body = await request.json();
    const data = bookingSchema.parse(body);

    const slot = await prisma.bookingSlot.findUnique({ where: { id: data.slotId } });
    if (!slot || !slot.isAvailable) {
      return NextResponse.json({ error: "This slot is no longer available" }, { status: 409 });
    }

    const existingBookings = await prisma.booking.count({
      where: { slotId: data.slotId, status: { not: "CANCELLED" } },
    });
    if (existingBookings >= slot.maxBookings) {
      return NextResponse.json({ error: "This slot is fully booked" }, { status: 409 });
    }

    const booking = await prisma.booking.create({
      data: {
        bookingRef: generateBookingRef(),
        userId: session.user.id,
        slotId: data.slotId,
        service: data.service,
        status: "PENDING",
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        notes: data.notes ?? null,
        hairDetails: data.hairDetails ?? {},
        totalAmount: slot.price,
        currency: slot.currency,
        depositAmount: null,
      },
    });

    logger.info("Booking created", { bookingRef: booking.bookingRef, userId: session.user.id });

    return NextResponse.json({ bookingRef: booking.bookingRef, bookingId: booking.id });
  } catch (err) {
    logger.error("POST /api/bookings failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create booking" },
      { status: 500 }
    );
  }
}
