import type { Metadata } from "next";
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { AddressesView } from "./AddressesView";

export const metadata: Metadata = { title: "My Addresses | RI Hair Collectables" };

export default async function AddressesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?next=/dashboard/addresses");

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return <AddressesView addresses={addresses} userId={session.user.id} />;
}
