import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { LoyaltyView } from "./LoyaltyView";

export const metadata: Metadata = { title: "Loyalty Rewards | RI Hair Collectables" };

async function getLoyalty(userId: string) {
  return prisma.loyaltyAccount.findUnique({
    where: { userId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

async function getReferral(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
}

export default async function LoyaltyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?next=/dashboard/loyalty");

  const [loyalty, userRef] = await Promise.all([
    getLoyalty(session.user.id),
    getReferral(session.user.id),
  ]);

  return <LoyaltyView loyalty={loyalty} referralCode={userRef?.referralCode ?? null} />;
}
