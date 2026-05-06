import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { InventoryView } from "./InventoryView";

export const metadata: Metadata = { title: "Inventory | RI Hair Admin" };

export default async function InventoryPage() {
  const variants = await prisma.productVariant.findMany({
    include: {
      product: { select: { name: true, slug: true, sku: true } },
    },
    orderBy: { stockQuantity: "asc" },
    take: 200,
  });

  return <InventoryView variants={variants} />;
}
