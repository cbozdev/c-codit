"use client";

import { useRouter, usePathname } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
  emailVerified: Date | null;
  _count: { orders: number };
  loyaltyAccount: { points: number; tier: string } | null;
}

interface Props {
  customers: Customer[];
  total: number;
  page: number;
  take: number;
  query?: string;
}

const TIER_STYLES: Record<string, string> = {
  BRONZE: "text-orange-700",
  SILVER: "text-neutral-500",
  GOLD: "text-[#C9A84C]",
  PLATINUM: "text-purple-700",
};

export function AdminCustomersView({ customers, total, page, take, query }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(query ?? "");
  const totalPages = Math.ceil(total / take);

  const applySearch = (q: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
      <h1 className="font-cormorant text-2xl font-semibold text-[#0A0A0A] mb-6">Customers</h1>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applySearch(search)}
          className="input-field pl-10"
          placeholder="Search by name or email…"
        />
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {["Customer", "Orders", "Loyalty", "Verified", "Joined"].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => (
              <motion.tr
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-neutral-50 hover:bg-neutral-50"
              >
                <td className="py-3 px-4">
                  <p className="font-medium text-[#0A0A0A]">{c.name ?? "—"}</p>
                  <p className="text-xs text-neutral-400">{c.email}</p>
                </td>
                <td className="py-3 px-4 text-neutral-600">{c._count.orders}</td>
                <td className="py-3 px-4">
                  {c.loyaltyAccount ? (
                    <span className={`text-xs font-semibold ${TIER_STYLES[c.loyaltyAccount.tier] ?? ""}`}>
                      {c.loyaltyAccount.tier} · {c.loyaltyAccount.points} pts
                    </span>
                  ) : (
                    <span className="text-neutral-400 text-xs">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-medium ${c.emailVerified ? "text-green-600" : "text-neutral-400"}`}>
                    {c.emailVerified ? "Yes" : "No"}
                  </span>
                </td>
                <td className="py-3 px-4 text-neutral-500 text-xs">
                  {new Date(c.createdAt).toLocaleDateString("en-GB")}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {customers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
            <p className="text-neutral-400">No customers found.</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="btn-ghost py-2 px-3 disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-neutral-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="btn-ghost py-2 px-3 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
