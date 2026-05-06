import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { CheckoutSuccessView } from "./CheckoutSuccessView";

export const metadata: Metadata = {
  title: "Order Confirmed | RI Hair Collectables",
  description: "Your order has been placed successfully.",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ orderId?: string }>;
}

async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: { select: { name: true, slug: true } },
          variant: { select: { lengthInches: true, density: true, color: true } },
        },
      },
      shippingAddress: true,
    },
  });
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { orderId } = await searchParams;

  if (!orderId) notFound();

  const order = await getOrder(orderId);
  if (!order) notFound();

  return (
    <Suspense>
      <CheckoutSuccessView order={order} />
    </Suspense>
  );
}
