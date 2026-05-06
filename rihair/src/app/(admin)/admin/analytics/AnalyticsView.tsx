"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users } from "lucide-react";

interface Props {
  revenueThisMonth: number;
  revenueLastMonth: number;
  ordersThisMonth: number;
  ordersLastMonth: number;
  newCustomersThisMonth: number;
  topProducts: { name: string; units: number; revenue: number }[];
  revenueByDay: { date: string; revenue: number }[];
}

function pct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function AnalyticsView({
  revenueThisMonth,
  revenueLastMonth,
  ordersThisMonth,
  ordersLastMonth,
  newCustomersThisMonth,
  topProducts,
  revenueByDay,
}: Props) {
  const revPct = pct(revenueThisMonth, revenueLastMonth);
  const ordPct = pct(ordersThisMonth, ordersLastMonth);

  const stats = [
    {
      label: "Revenue (30d)",
      value: fmt(revenueThisMonth),
      pct: revPct,
      icon: DollarSign,
    },
    {
      label: "Orders (30d)",
      value: ordersThisMonth.toString(),
      pct: ordPct,
      icon: ShoppingCart,
    },
    {
      label: "New Customers (30d)",
      value: newCustomersThisMonth.toString(),
      pct: null,
      icon: Users,
    },
  ];

  const maxRevenue = Math.max(...revenueByDay.map((d) => d.revenue), 1);

  return (
    <div>
      <h1 className="font-cormorant text-2xl font-semibold text-[#0A0A0A] mb-6">Analytics</h1>
      <p className="text-sm text-neutral-400 mb-6">Last 30 days vs. previous 30 days</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card-elevated p-6"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                {s.label}
              </span>
              <s.icon className="w-4 h-4 text-[#C9A84C]" />
            </div>
            <p className="font-cormorant text-3xl font-semibold text-[#0A0A0A] mb-2">{s.value}</p>
            {s.pct !== null && (
              <div className={`flex items-center gap-1 text-xs font-medium ${s.pct >= 0 ? "text-green-600" : "text-red-500"}`}>
                {s.pct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {Math.abs(s.pct).toFixed(1)}% vs last 30d
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-elevated p-6"
        >
          <h2 className="font-cormorant text-xl font-semibold text-[#0A0A0A] mb-4">
            Daily Revenue
          </h2>
          <div className="flex items-end gap-1 h-32">
            {revenueByDay.slice(-30).map((d, i) => (
              <div
                key={d.date}
                title={`${d.date}: ${fmt(d.revenue)}`}
                className="flex-1 bg-[#C9A84C] rounded-t-sm transition-all hover:opacity-80"
                style={{ height: `${(d.revenue / maxRevenue) * 100}%`, minHeight: 2 }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-neutral-400 mt-2">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </motion.div>

        {/* Top products */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card-elevated p-6"
        >
          <h2 className="font-cormorant text-xl font-semibold text-[#0A0A0A] mb-4">
            Top Products (30d)
          </h2>
          <ul className="space-y-3">
            {topProducts.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0A0A0A] line-clamp-1">{p.name}</p>
                  <p className="text-xs text-neutral-400">{p.units} units sold</p>
                </div>
                <span className="text-sm font-semibold text-[#0A0A0A]">{fmt(p.revenue)}</span>
              </li>
            ))}
            {topProducts.length === 0 && (
              <p className="text-sm text-neutral-400">No sales data yet.</p>
            )}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
