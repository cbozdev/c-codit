import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { AdminProductsView } from "./AdminProductsView";

export const metadata: Metadata = { title: "Products | RI Hair Admin" };

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      variants: { select: { stockQuantity: true } },
    },
    take: 100,
  });

  return <AdminProductsView products={products} />;
}
