import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { CustomerDashboardView } from "./CustomerDashboardView";

export const metadata: Metadata = { title: "My Account" };

export default async function CustomerDashboardPage() {
  const session = await requireAuth();

  const [recentOrders, loyaltyAccount, wishlistCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: { take: 2, include: { product: { select: { name: true } } } },
        payment: { select: { status: true } },
      },
    }),
    prisma.loyaltyAccount.findUnique({ where: { userId: session.user.id } }),
    prisma.wishlistItem.count({ where: { userId: session.user.id } }),
  ]);

  return (
    <CustomerDashboardView
      user={session.user}
      recentOrders={recentOrders}
      loyaltyAccount={loyaltyAccount}
      wishlistCount={wishlistCount}
    />
  );
}
