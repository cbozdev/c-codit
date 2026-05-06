import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { AnalyticsView } from "./AnalyticsView";

export const metadata: Metadata = { title: "Analytics | RI Hair Admin" };

export const revalidate = 300;

export default async function AnalyticsPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [
    revenueThisMonth,
    revenueLastMonth,
    ordersThisMonth,
    ordersLastMonth,
    newCustomersThisMonth,
    topProducts,
    revenueByDay,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      _sum: { total: true },
    }),
    prisma.order.count({
      where: { createdAt: { gte: thirtyDaysAgo }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo }, role: "CUSTOMER" } }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    prisma.$queryRaw<{ date: string; revenue: number }[]>`
      SELECT DATE(created_at) as date, SUM(total)::float as revenue
      FROM orders
      WHERE created_at >= ${thirtyDaysAgo}
        AND status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `,
  ]);

  const productIds = topProducts.map((p) => p.productId);
  const productNames = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(productNames.map((p) => [p.id, p.name]));

  function parseDecimal(v: unknown): number {
    if (v && typeof v === "object" && "toNumber" in (v as object))
      return (v as { toNumber(): number }).toNumber();
    return Number(v ?? 0);
  }

  return (
    <AnalyticsView
      revenueThisMonth={parseDecimal(revenueThisMonth._sum.total)}
      revenueLastMonth={parseDecimal(revenueLastMonth._sum.total)}
      ordersThisMonth={ordersThisMonth}
      ordersLastMonth={ordersLastMonth}
      newCustomersThisMonth={newCustomersThisMonth}
      topProducts={topProducts.map((p) => ({
        name: nameMap[p.productId] ?? "Unknown",
        units: p._sum.quantity ?? 0,
        revenue: parseDecimal(p._sum.total),
      }))}
      revenueByDay={revenueByDay}
    />
  );
}
