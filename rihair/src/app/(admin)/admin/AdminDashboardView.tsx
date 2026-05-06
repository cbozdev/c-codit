"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  Users,
  DollarSign,
  Package,
  AlertTriangle,
  Calendar,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { formatPrice } from "@/lib/utils/currency";
import { Badge } from "@/components/ui/Badge";
import type { Order, User, Payment, ProductVariant, Product } from "@prisma/client";

type OrderRow = Order & {
  user: Pick<User, "firstName" | "lastName" | "email"> | null;
  payment: Pick<Payment, "status" | "provider"> | null;
};

type VariantRow = ProductVariant & {
  product: Pick<Product, "name" | "slug">;
};

type AdminDashboardViewProps = {
  stats: {
    totalOrders: number;
    totalRevenue: number;
    newCustomers: number;
    pendingOrders: number;
    totalProducts: number;
    activeBookings: number;
  };
  recentOrders: OrderRow[];
  lowStockVariants: VariantRow[];
};

const STAT_CARDS = (stats: AdminDashboardViewProps["stats"]) => [
  {
    label: "Revenue (30d)",
    value: formatPrice(stats.totalRevenue, "USD"),
    icon: DollarSign,
    color: "text-brand-gold",
    href: "/admin/orders",
  },
  {
    label: "Orders (30d)",
    value: stats.totalOrders.toLocaleString(),
    icon: ShoppingBag,
    color: "text-blue-400",
    href: "/admin/orders",
  },
  {
    label: "New Customers",
    value: stats.newCustomers.toLocaleString(),
    icon: Users,
    color: "text-emerald-400",
    href: "/admin/customers",
  },
  {
    label: "Pending Orders",
    value: stats.pendingOrders.toLocaleString(),
    icon: TrendingUp,
    color: "text-amber-400",
    href: "/admin/orders?status=PENDING",
  },
  {
    label: "Active Products",
    value: stats.totalProducts.toLocaleString(),
    icon: Package,
    color: "text-purple-400",
    href: "/admin/products",
  },
  {
    label: "Active Bookings",
    value: stats.activeBookings.toLocaleString(),
    icon: Calendar,
    color: "text-cyan-400",
    href: "/admin/bookings",
  },
];

export function AdminDashboardView({
  stats,
  recentOrders,
  lowStockVariants,
}: AdminDashboardViewProps) {
  const statCards = STAT_CARDS(stats);

  return (
    <div className="container-brand py-8 space-y-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-text-primary mb-1">
          Dashboard
        </h1>
        <p className="text-text-muted text-sm">Last 30 days overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, href }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <Link
              href={href}
              className="card-elevated p-5 flex flex-col gap-3 hover:border-brand-gold/20 transition-colors group block"
            >
              <div className={`w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="font-display text-xl lg:text-2xl font-medium text-text-primary">
                  {value}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{label}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="xl:col-span-2 card-elevated overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <h2 className="font-display text-lg font-medium text-text-primary">
              Recent Orders
            </h2>
            <Link
              href="/admin/orders"
              className="text-xs text-brand-gold hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {recentOrders.length === 0 ? (
              <p className="px-5 py-8 text-sm text-text-muted text-center">
                No recent orders
              </p>
            ) : (
              recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">
                      #{order.orderNumber}
                    </p>
                    <p className="text-xs text-text-muted truncate">
                      {order.user
                        ? `${order.user.firstName} ${order.user.lastName}`
                        : order.guestEmail ?? "Guest"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-text-primary">
                      {formatPrice(Number(order.total), order.currency)}
                    </span>
                    <Badge
                      variant={
                        order.status === "DELIVERED" ? "success"
                          : order.status === "CANCELLED" ? "error"
                          : order.status === "PENDING" ? "warning"
                          : "info"
                      }
                      size="sm"
                      dot
                    >
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Low Stock */}
        <div className="card-elevated overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="font-display text-lg font-medium text-text-primary">
                Low Stock
              </h2>
            </div>
            <Link
              href="/admin/products?filter=low-stock"
              className="text-xs text-brand-gold hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-border-subtle">
            {lowStockVariants.length === 0 ? (
              <p className="px-5 py-8 text-sm text-text-muted text-center">
                All products are well stocked
              </p>
            ) : (
              lowStockVariants.map((variant) => (
                <Link
                  key={variant.id}
                  href={`/admin/products/${variant.productId}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {variant.product.name}
                    </p>
                    <p className="text-2xs text-text-muted">
                      SKU: {variant.sku}
                    </p>
                  </div>
                  <Badge
                    variant={variant.stockQuantity === 0 ? "error" : "warning"}
                    size="sm"
                  >
                    {variant.stockQuantity === 0 ? "Out" : `${variant.stockQuantity} left`}
                  </Badge>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
