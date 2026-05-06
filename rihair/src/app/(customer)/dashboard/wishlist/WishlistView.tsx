"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { useCurrencyStore } from "@/stores/currency.store";
import toast from "react-hot-toast";
import type { Prisma } from "@prisma/client";

type WishlistItemWithProduct = Prisma.WishlistItemGetPayload<{
  include: {
    product: {
      select: {
        id: true;
        slug: true;
        name: true;
        basePrice: true;
        compareAtPrice: true;
        currency: true;
        images: { where: { isPrimary: true }; take: 1; select: { url: true; altText: true } };
        variants: { where: { stockQuantity: { gt: 0 } }; take: 1; select: { id: true } };
      };
    };
  };
}>;

function parsePrice(value: unknown): number {
  if (value && typeof value === "object" && "toNumber" in (value as object)) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
}

export function WishlistView({ items }: { items: WishlistItemWithProduct[] }) {
  const addItem = useCartStore((s) => s.addItem);
  const { convert, currency } = useCurrencyStore();

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <Heart className="w-12 h-12 text-neutral-200 mx-auto mb-4" />
        <h2 className="font-cormorant text-2xl font-medium text-[#0A0A0A] mb-2">
          Your wishlist is empty
        </h2>
        <p className="text-neutral-500 text-sm mb-6">
          Save products you love to come back to them later.
        </p>
        <Link href="/shop" className="btn-primary">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item, i) => {
        const p = item.product;
        const price = parsePrice(p.basePrice);
        const compareAt = p.compareAtPrice ? parsePrice(p.compareAtPrice) : null;
        const inStock = (p.variants?.length ?? 0) > 0;
        const image = p.images?.[0];

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card-elevated overflow-hidden group"
          >
            <Link href={`/products/${p.slug}`} className="block relative aspect-[3/4] bg-neutral-100">
              {image ? (
                <Image
                  src={image.url}
                  alt={image.altText ?? p.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShoppingBag className="w-8 h-8 text-neutral-300" />
                </div>
              )}
            </Link>

            <div className="p-4">
              <Link
                href={`/products/${p.slug}`}
                className="font-medium text-[#0A0A0A] text-sm hover:text-[#C9A84C] transition-colors line-clamp-2 mb-2"
              >
                {p.name}
              </Link>

              <div className="flex items-center gap-2 mb-3">
                <span className="font-semibold text-[#0A0A0A]">{convert(price, currency)}</span>
                {compareAt && (
                  <span className="text-xs text-neutral-400 line-through">
                    {convert(compareAt, currency)}
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  if (!inStock) return;
                  const variant = p.variants?.[0];
                  addItem({
                    productId: p.id,
                    variantId: variant?.id ?? "",
                    name: p.name,
                    price,
                    image: image?.url,
                    quantity: 1,
                  });
                  toast.success("Added to bag!");
                }}
                disabled={!inStock}
                className="btn-primary w-full justify-center text-xs py-2"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {inStock ? "Add to Bag" : "Out of Stock"}
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
