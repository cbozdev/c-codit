import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { AdminDashboardView } from "./AdminDashboardView";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminPage() {
  await requireAdmin();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalOrders,
    totalRevenue,
    recentOrders,
    newCustomers,
    pendingOrders,
    lowStockVariants,
    totalProducts,
    activeBookings,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.order.aggregate({
      where: { status: { in: ["PAYMENT_CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] }, createdAt: { gte: thirtyDaysAgo } },
      _sum: { total: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        payment: { select: { status: true, provider: true } },
      },
    }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo }, role: "CUSTOMER" } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.productVariant.findMany({
      where: { stockQuantity: { lte: 5 }, isAvailable: true },
      include: { product: { select: { name: true, slug: true } } },
      take: 10,
      orderBy: { stockQuantity: "asc" },
    }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.booking.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
  ]);

  return (
    <AdminDashboardView
      stats={{
        totalOrders,
        totalRevenue: Number(totalRevenue._sum.total ?? 0),
        newCustomers,
        pendingOrders,
        totalProducts,
        activeBookings,
      }}
      recentOrders={recentOrders}
      lowStockVariants={lowStockVariants}
    />
  );
}
