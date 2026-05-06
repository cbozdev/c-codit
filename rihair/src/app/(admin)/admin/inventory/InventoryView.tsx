"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Prisma } from "@prisma/client";

type VariantRow = Prisma.ProductVariantGetPayload<{
  include: { product: { select: { name: true; slug: true; sku: true } } };
}>;

export function InventoryView({ variants }: { variants: VariantRow[] }) {
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});
  const router = useRouter();

  const filtered = variants.filter((v) =>
    v.product.name.toLowerCase().includes(search.toLowerCase()) ||
    v.sku.toLowerCase().includes(search.toLowerCase())
  );

  const updateStock = async (variantId: string) => {
    const newQty = stockEdits[variantId];
    if (newQty === undefined) return;
    setUpdating(variantId);
    const res = await fetch(`/api/admin/inventory/${variantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockQuantity: newQty }),
    });
    setUpdating(null);
    if (!res.ok) { toast.error("Update failed."); return; }
    toast.success("Stock updated.");
    setStockEdits((prev) => { const next = { ...prev }; delete next[variantId]; return next; });
    router.refresh();
  };

  const lowStock = variants.filter((v) => v.stockQuantity <= (v.lowStockThreshold ?? 3));

  return (
    <div>
      <h1 className="font-cormorant text-2xl font-semibold text-[#0A0A0A] mb-6">Inventory</h1>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 text-sm">
              {lowStock.length} variant{lowStock.length > 1 ? "s" : ""} running low on stock
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Review and restock the items highlighted in red below.
            </p>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
          placeholder="Search by product name or SKU…"
        />
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {["Product", "SKU", "Length", "Density", "Stock", "Low Stock Alert", "Update"].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => {
              const isLow = v.stockQuantity <= (v.lowStockThreshold ?? 3);
              const editVal = stockEdits[v.id] ?? v.stockQuantity;

              return (
                <motion.tr
                  key={v.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`border-b border-neutral-50 ${isLow ? "bg-red-50/40" : "hover:bg-neutral-50"}`}
                >
                  <td className="py-3 px-4">
                    <p className="font-medium text-[#0A0A0A] line-clamp-1">{v.product.name}</p>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-neutral-500">{v.sku}</td>
                  <td className="py-3 px-4 text-neutral-600">
                    {v.lengthInches ? `${v.lengthInches}"` : "—"}
                  </td>
                  <td className="py-3 px-4 text-neutral-600">
                    {v.density ? v.density.replace("DENSITY_", "") + "%" : "—"}
                  </td>
                  <td className="py-3 px-4">
                    <span className={isLow ? "font-bold text-red-600" : "text-neutral-700"}>
                      {v.stockQuantity}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-neutral-500">{v.lowStockThreshold ?? 3}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={editVal}
                        onChange={(e) =>
                          setStockEdits((prev) => ({ ...prev, [v.id]: parseInt(e.target.value) || 0 }))
                        }
                        className="w-16 input-field py-1 text-xs"
                      />
                      {stockEdits[v.id] !== undefined && stockEdits[v.id] !== v.stockQuantity && (
                        <button
                          onClick={() => updateStock(v.id)}
                          disabled={updating === v.id}
                          className="text-xs btn-primary py-1 px-2"
                        >
                          {updating === v.id ? "…" : "Save"}
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
