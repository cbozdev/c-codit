import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { BookingPageClient } from "./BookingPageClient";
import { BOOKING_SERVICES } from "@/config/services";

export const metadata: Metadata = {
  title: "Book a Service",
  description:
    "Book a professional wig installation, hair consultation, or custom wig creation with our expert stylists.",
};

export const revalidate = 3600;

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;

  const now = new Date();
  const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const slots = await prisma.bookingSlot.findMany({
    where: {
      isAvailable: true,
      date: { gte: now, lte: twoWeeksOut },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: {
      _count: { select: { bookings: { where: { status: { not: "CANCELLED" } } } } },
    },
  });

  const availableSlots = slots.filter(
    (s) => s._count.bookings < s.maxBookings
  );

  return (
    <BookingPageClient
      services={BOOKING_SERVICES}
      availableSlots={availableSlots}
      initialService={service}
    />
  );
}
