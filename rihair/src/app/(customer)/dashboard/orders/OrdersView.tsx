"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Package, ChevronRight, ExternalLink } from "lucide-react";
import type { Prisma } from "@prisma/client";

type OrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: { select: { name: true; slug: true } };
        variant: { select: { lengthInches: true; density: true } };
      };
    };
    shipment: { select: { trackingNumber: true; carrier: true; trackingUrl: true } };
  };
}>;

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  PROCESSING: "bg-purple-50 text-purple-700 border-purple-200",
  SHIPPED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  DELIVERED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  REFUNDED: "bg-neutral-50 text-neutral-700 border-neutral-200",
};

function formatPrice(value: unknown): string {
  const num =
    value && typeof value === "object" && "toNumber" in (value as object)
      ? (value as { toNumber(): number }).toNumber()
      : Number(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

export function OrdersView({ orders }: { orders: OrderWithItems[] }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-20">
        <Package className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
        <h2 className="font-cormorant text-2xl font-medium text-[#0A0A0A] mb-2">
          No orders yet
        </h2>
        <p className="text-neutral-500 text-sm mb-6">
          Your order history will appear here after your first purchase.
        </p>
        <Link href="/shop" className="btn-primary">
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order, i) => (
        <motion.div
          key={order.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="card-elevated p-6"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-neutral-400 mb-0.5">Order</p>
              <p className="font-mono font-semibold text-[#0A0A0A]">#{order.orderNumber}</p>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING
              }`}
            >
              {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
            </span>
          </div>

          <ul className="text-sm text-neutral-600 space-y-1 mb-4">
            {order.items.slice(0, 3).map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0" />
                <span>
                  {item.product.name}
                  {item.variant?.lengthInches && ` — ${item.variant.lengthInches}"`}
                  <span className="text-neutral-400"> ×{item.quantity}</span>
                </span>
              </li>
            ))}
            {order.items.length > 3 && (
              <li className="text-neutral-400 text-xs pl-3">
                +{order.items.length - 3} more item{order.items.length - 3 > 1 ? "s" : ""}
              </li>
            )}
          </ul>

          <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
            <div className="text-sm">
              <span className="text-neutral-500">Total: </span>
              <span className="font-semibold text-[#0A0A0A]">{formatPrice(order.total)}</span>
              <span className="text-neutral-400 ml-2">
                · {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {order.shipment?.trackingUrl && (
                <a
                  href={order.shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#C9A84C] hover:underline flex items-center gap-1"
                >
                  Track <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <Link
                href={`/dashboard/orders/${order.id}`}
                className="text-xs text-[#0A0A0A] font-medium flex items-center gap-1 hover:text-[#C9A84C] transition-colors"
              >
                Details <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
