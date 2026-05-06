"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import type { Prisma } from "@prisma/client";

type OrderRow = Prisma.OrderGetPayload<{
  include: {
    user: { select: { name: true; email: true } };
    items: { select: { quantity: true } };
    shipment: { select: { trackingNumber: true } };
  };
}>;

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  PROCESSING: "bg-purple-50 text-purple-700",
  SHIPPED: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-600",
  REFUNDED: "bg-neutral-50 text-neutral-600",
};

function parsePrice(v: unknown): number {
  if (v && typeof v === "object" && "toNumber" in (v as object))
    return (v as { toNumber(): number }).toNumber();
  return Number(v);
}

interface Props {
  orders: OrderRow[];
  total: number;
  page: number;
  take: number;
  currentStatus?: string;
}

export function AdminOrdersView({ orders, total, page, take, currentStatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setStatus = (s?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (s) params.set("status", s); else params.delete("status");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  const updateStatus = async (orderId: string, status: string) => {
    const res = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { toast.error("Update failed."); return; }
    toast.success("Status updated.");
    router.refresh();
  };

  const totalPages = Math.ceil(total / take);

  return (
    <div>
      <h1 className="font-cormorant text-2xl font-semibold text-[#0A0A0A] mb-6">Orders</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStatus(undefined)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !currentStatus ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "border-neutral-200 text-neutral-600 hover:border-[#0A0A0A]"
          }`}
        >
          All ({total})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              currentStatus === s ? "bg-[#0A0A0A] text-white border-[#0A0A0A]" : "border-neutral-200 text-neutral-600 hover:border-[#0A0A0A]"
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {["Order", "Customer", "Items", "Total", "Status", "Date", "Actions"].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order, i) => {
              const itemCount = order.items.reduce((a, it) => a + it.quantity, 0);
              return (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-neutral-50 hover:bg-neutral-50"
                >
                  <td className="py-3 px-4 font-mono text-xs">#{order.orderNumber}</td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#0A0A0A]">{order.user?.name ?? "Guest"}</p>
                    <p className="text-xs text-neutral-400">{order.user?.email}</p>
                  </td>
                  <td className="py-3 px-4 text-neutral-600">{itemCount}</td>
                  <td className="py-3 px-4 font-medium">${parsePrice(order.total).toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <select
                      defaultValue={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full font-medium border-0 outline-none cursor-pointer ${STATUS_STYLES[order.status] ?? ""}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-4 text-neutral-500 text-xs">
                    {new Date(order.createdAt).toLocaleDateString("en-GB")}
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/admin/orders/${order.id}`} className="text-xs text-[#C9A84C] hover:underline">
                      View
                    </Link>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        {orders.length === 0 && (
          <div className="text-center py-12 text-neutral-400">No orders found.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="btn-ghost py-2 px-3 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-neutral-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            className="btn-ghost py-2 px-3 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
