import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { OrdersView } from "./OrdersView";

export const metadata: Metadata = { title: "My Orders | RI Hair Collectables" };

async function getOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: { select: { name: true, slug: true } },
          variant: { select: { lengthInches: true, density: true } },
        },
      },
      shipment: { select: { trackingNumber: true, carrier: true, trackingUrl: true } },
    },
    take: 50,
  });
}

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?next=/dashboard/orders");

  const orders = await getOrders(session.user.id);
  return <OrdersView orders={orders} />;
}
