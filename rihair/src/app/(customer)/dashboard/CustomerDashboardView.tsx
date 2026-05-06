"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  Heart,
  Star,
  Gift,
  MapPin,
  ChevronRight,
  Package,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { GoldDivider } from "@/components/ui/GoldDivider";
import type { Order, OrderItem, Payment, Product, LoyaltyAccount } from "@prisma/client";

type OrderWithItems = Order & {
  items: (OrderItem & { product: Pick<Product, "name"> })[];
  payment: Pick<Payment, "status"> | null;
};

type DashboardProps = {
  user: { id: string; name: string | null; email: string; firstName: string | null; lastName: string | null };
  recentOrders: OrderWithItems[];
  loyaltyAccount: LoyaltyAccount | null;
  wishlistCount: number;
};

const ORDER_STATUS_CONFIG = {
  PENDING: { label: "Pending", icon: Clock, color: "warning" },
  PAYMENT_PENDING: { label: "Awaiting Payment", icon: Clock, color: "warning" },
  PAYMENT_CONFIRMED: { label: "Confirmed", icon: CheckCircle, color: "success" },
  PROCESSING: { label: "Processing", icon: Package, color: "info" },
  SHIPPED: { label: "Shipped", icon: Package, color: "info" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", icon: Package, color: "info" },
  DELIVERED: { label: "Delivered", icon: CheckCircle, color: "success" },
  CANCELLED: { label: "Cancelled", icon: XCircle, color: "error" },
  REFUNDED: { label: "Refunded", icon: XCircle, color: "muted" },
  PARTIALLY_REFUNDED: { label: "Part Refunded", icon: XCircle, color: "muted" },
  RETURN_REQUESTED: { label: "Return Requested", icon: Clock, color: "warning" },
  RETURNED: { label: "Returned", icon: XCircle, color: "muted" },
} as const;

const LOYALTY_TIERS = {
  bronze: { label: "Bronze", min: 0, max: 500, color: "#CD7F32" },
  silver: { label: "Silver", min: 500, max: 2000, color: "#C0C0C0" },
  gold: { label: "Gold", min: 2000, max: 5000, color: "#C9A84C" },
  platinum: { label: "Platinum", min: 5000, max: Infinity, color: "#E5E4E2" },
};

function getLoyaltyTier(points: number) {
  if (points >= 5000) return LOYALTY_TIERS.platinum;
  if (points >= 2000) return LOYALTY_TIERS.gold;
  if (points >= 500) return LOYALTY_TIERS.silver;
  return LOYALTY_TIERS.bronze;
}

export function CustomerDashboardView({
  user,
  recentOrders,
  loyaltyAccount,
  wishlistCount,
}: DashboardProps) {
  const firstName = user.firstName ?? user.name?.split(" ")[0] ?? "there";
  const points = loyaltyAccount?.points ?? 0;
  const tier = getLoyaltyTier(points);

  const QUICK_LINKS = [
    { href: "/account/orders", icon: ShoppingBag, label: "Orders", value: recentOrders.length },
    { href: "/account/wishlist", icon: Heart, label: "Wishlist", value: wishlistCount },
    { href: "/account/loyalty", icon: Star, label: "Points", value: points },
    { href: "/account/addresses", icon: MapPin, label: "Addresses", value: null },
  ];

  return (
    <div className="container-narrow py-10 lg:py-16 space-y-10">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-label mb-1">Welcome back</p>
        <h1 className="font-display text-3xl lg:text-4xl font-medium text-text-primary">
          Hi, {firstName} 👋
        </h1>
        <p className="text-text-muted text-sm mt-1">{user.email}</p>
      </motion.div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK_LINKS.map(({ href, icon: Icon, label, value }, i) => (
          <motion.div
            key={href}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
          >
            <Link
              href={href}
              className="card-elevated p-5 flex flex-col gap-3 group hover:border-brand-gold/30 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center group-hover:bg-brand-gold/20 transition-colors">
                <Icon className="w-5 h-5 text-brand-gold" />
              </div>
              <div>
                <p className="font-display text-xl font-medium text-text-primary">
                  {value !== null ? value.toLocaleString() : "→"}
                </p>
                <p className="text-xs text-text-muted">{label}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Loyalty Points */}
      {loyaltyAccount && (
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-brand-gold" />
              <h2 className="font-display text-lg font-medium text-text-primary">
                Loyalty Rewards
              </h2>
            </div>
            <Badge variant="gold" size="md">
              {tier.label}
            </Badge>
          </div>
          <p className="text-3xl font-display font-medium text-brand-gold mb-1">
            {points.toLocaleString()} pts
          </p>
          <p className="text-xs text-text-muted mb-4">
            {loyaltyAccount.lifetimeEarned.toLocaleString()} points earned lifetime
          </p>

          {tier !== LOYALTY_TIERS.platinum && (
            <>
              <div className="h-2 bg-surface-tertiary rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-gradient-gold rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(100, ((points - tier.min) / (tier.max - tier.min)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-text-muted">
                {(tier.max - points).toLocaleString()} more points to reach{" "}
                {Object.values(LOYALTY_TIERS).find((t) => t.min === tier.max)?.label}
              </p>
            </>
          )}
        </div>
      )}

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <GoldDivider label="Recent Orders" className="flex-1" />
          <Link
            href="/account/orders"
            className="ml-4 text-sm text-brand-gold hover:underline flex-shrink-0"
          >
            View all
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="card-elevated p-8 text-center">
            <ShoppingBag className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary">No orders yet</p>
            <Link
              href="/shop"
              className="text-sm text-brand-gold hover:underline mt-2 inline-block"
            >
              Start shopping →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => {
              const statusConfig =
                ORDER_STATUS_CONFIG[order.status] ?? ORDER_STATUS_CONFIG.PENDING;
              const StatusIcon = statusConfig.icon;

              return (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="card-elevated p-4 flex items-center justify-between gap-4 hover:border-brand-gold/20 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-text-muted" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        #{order.orderNumber}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {order.items.map((i) => i.product.name).join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={statusConfig.color as never} size="sm" dot>
                      {statusConfig.label}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-brand-gold transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
