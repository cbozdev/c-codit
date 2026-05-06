import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { AdminBookingsView } from "./AdminBookingsView";

export const metadata: Metadata = { title: "Bookings | RI Hair Admin" };

export default async function AdminBookingsPage() {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      slot: true,
      user: { select: { name: true, email: true } },
    },
    take: 100,
  });

  return <AdminBookingsView bookings={bookings} />;
}
