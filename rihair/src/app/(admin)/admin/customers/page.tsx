import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { AdminCustomersView } from "./AdminCustomersView";

export const metadata: Metadata = { title: "Customers | RI Hair Admin" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const take = 30;
  const skip = (pageNum - 1) * take;

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
        role: "CUSTOMER" as const,
      }
    : { role: "CUSTOMER" as const };

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        emailVerified: true,
        _count: { select: { orders: true } },
        loyaltyAccount: { select: { points: true, tier: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <AdminCustomersView customers={customers} total={total} page={pageNum} take={take} query={q} />
  );
}
