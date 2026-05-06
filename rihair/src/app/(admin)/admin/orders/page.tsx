import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { AdminOrdersView } from "./AdminOrdersView";

export const metadata: Metadata = { title: "Orders | RI Hair Admin" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const take = 25;
  const skip = (pageNum - 1) * take;

  const where = status ? { status: status as never } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        user: { select: { name: true, email: true } },
        items: { select: { quantity: true } },
        shipment: { select: { trackingNumber: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return (
    <AdminOrdersView
      orders={orders}
      total={total}
      page={pageNum}
      take={take}
      currentStatus={status}
    />
  );
}
