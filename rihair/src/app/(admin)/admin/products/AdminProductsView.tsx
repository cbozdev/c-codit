"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import type { Prisma } from "@prisma/client";

type ProductRow = Prisma.ProductGetPayload<{
  include: {
    category: { select: { name: true } };
    images: { where: { isPrimary: true }; take: 1; select: { url: true } };
    variants: { select: { stockQuantity: true } };
  };
}>;

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  DRAFT: "bg-neutral-50 text-neutral-600 border-neutral-200",
  ARCHIVED: "bg-red-50 text-red-600 border-red-200",
};

function parsePrice(v: unknown): number {
  if (v && typeof v === "object" && "toNumber" in (v as object))
    return (v as { toNumber(): number }).toNumber();
  return Number(v);
}

export function AdminProductsView({ products }: { products: ProductRow[] }) {
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const deleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) { toast.error("Delete failed."); return; }
    toast.success("Product deleted.");
    router.refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-cormorant text-2xl font-semibold text-[#0A0A0A]">Products</h1>
        <Link href="/admin/products/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Product
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10"
          placeholder="Search by name or SKU…"
        />
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100">
              {["Product", "Category", "Price", "Stock", "Status", ""].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const totalStock = p.variants.reduce((a, v) => a + v.stockQuantity, 0);
              const image = p.images?.[0];

              return (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                        {image && (
                          <Image src={image.url} alt={p.name} width={40} height={40} className="object-cover w-full h-full" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[#0A0A0A] line-clamp-1">{p.name}</p>
                        <p className="text-xs text-neutral-400 font-mono">{p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-neutral-600">{p.category?.name ?? "—"}</td>
                  <td className="py-3 px-4 font-medium">
                    ${parsePrice(p.basePrice).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={totalStock <= 5 ? "text-red-600 font-medium" : "text-neutral-600"}>
                      {totalStock}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[p.status] ?? STATUS_STYLES.DRAFT}`}>
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/products/${p.slug}`} target="_blank" className="text-neutral-400 hover:text-[#0A0A0A] transition-colors">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <Link href={`/admin/products/${p.id}/edit`} className="text-neutral-400 hover:text-[#C9A84C] transition-colors">
                        <Edit className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => deleteProduct(p.id)}
                        disabled={deleting === p.id}
                        className="text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            {search ? "No products match your search." : "No products yet."}
          </div>
        )}
      </div>
    </div>
  );
}
