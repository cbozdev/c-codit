"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, ShoppingBag, Eye, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatPrice, parseDecimalPrice } from "@/lib/utils/currency";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useCurrencyStore } from "@/stores/currency.store";
import { Button } from "./Button";
import type { ProductCardData } from "@/types";
import { nanoid } from "nanoid";

type ProductCardProps = {
  product: ProductCardData;
  priority?: boolean;
  className?: string;
};

export function ProductCard({ product, priority = false, className }: ProductCardProps) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const { has: isWishlisted, toggle: toggleWishlist } = useWishlistStore();
  const { currency, convert } = useCurrencyStore();

  const wishlisted = isWishlisted(product.id);

  const displayPrice = convert(
    parseDecimalPrice(product.basePrice),
    product.currency as Parameters<typeof convert>[1]
  );
  const comparePrice = product.compareAtPrice
    ? convert(
        parseDecimalPrice(product.compareAtPrice),
        product.currency as Parameters<typeof convert>[1]
      )
    : null;

  const discount = comparePrice
    ? Math.round(((comparePrice - displayPrice) / comparePrice) * 100)
    : 0;

  const primaryVariant = product.variants[0];

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!primaryVariant) return;

      addItem({
        id: nanoid(),
        productId: product.id,
        variantId: primaryVariant.id,
        product: {
          id: product.id,
          slug: product.slug,
          name: product.name,
          requiresShipping: true,
          primaryImage: product.primaryImage,
        },
        variant: {
          id: primaryVariant.id,
          sku: `${product.slug}-v1`,
          price: primaryVariant.price,
          stockQuantity: primaryVariant.stockQuantity,
          color: primaryVariant.color ?? null,
          lengthInches: primaryVariant.lengthInches ?? null,
          density: primaryVariant.density ?? null,
        },
        quantity: 1,
        unitPrice: parseDecimalPrice(primaryVariant.price),
        lineTotal: parseDecimalPrice(primaryVariant.price),
      });
    },
    [addItem, product, primaryVariant]
  );

  const handleWishlist = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      toggleWishlist(product.id);
    },
    [toggleWishlist, product.id]
  );

  const inStock = product.variants.some((v) => v.stockQuantity > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("group relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={`/products/${product.slug}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-2xl"
      >
        {/* Image Container */}
        <div className="relative aspect-product bg-surface-secondary rounded-2xl overflow-hidden mb-4">
          {product.primaryImage ? (
            <Image
              src={product.primaryImage}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
              className={cn(
                "object-cover transition-all duration-700",
                isImageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
                isHovered && "scale-105"
              )}
              onLoad={() => setIsImageLoaded(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-tertiary">
              <span className="text-text-muted text-sm">No image</span>
            </div>
          )}

          {!isImageLoaded && product.primaryImage && (
            <div className="absolute inset-0 bg-surface-tertiary shimmer-effect" />
          )}

          {/* Overlay on hover */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-gradient-hero pointer-events-none"
          />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {product.isNewArrival && (
              <span className="badge-new">New</span>
            )}
            {product.isBestSeller && (
              <span className="badge-bestseller">Best Seller</span>
            )}
            {discount > 0 && (
              <span className="badge-sale">-{discount}%</span>
            )}
          </div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: isHovered ? 1 : 0, x: isHovered ? 0 : 8 }}
            transition={{ duration: 0.2 }}
            className="absolute top-3 right-3 flex flex-col gap-2"
          >
            <button
              onClick={handleWishlist}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className={cn(
                "btn-icon",
                wishlisted && "bg-brand-gold/20 border-brand-gold text-brand-gold"
              )}
            >
              <Heart
                className="w-4 h-4"
                fill={wishlisted ? "currentColor" : "none"}
              />
            </button>
            <Link
              href={`/products/${product.slug}`}
              aria-label="Quick view"
              className="btn-icon"
              tabIndex={-1}
            >
              <Eye className="w-4 h-4" />
            </Link>
          </motion.div>

          {/* Add to Cart */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 8 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="absolute bottom-3 left-3 right-3"
          >
            {inStock ? (
              <Button
                onClick={handleAddToCart}
                variant="primary"
                size="sm"
                fullWidth
                icon={<ShoppingBag className="w-4 h-4" />}
                className="shadow-elevation-3"
              >
                Add to Bag
              </Button>
            ) : (
              <Button
                variant="dark"
                size="sm"
                fullWidth
                disabled
              >
                Out of Stock
              </Button>
            )}
          </motion.div>

          {!inStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
              <span className="text-text-secondary text-sm font-medium bg-surface-primary/80 px-3 py-1 rounded-full">
                Sold Out
              </span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-1.5 px-1">
          <p className="text-2xs text-brand-gold font-semibold uppercase tracking-wider">
            {product.category.name}
          </p>

          <h3 className="font-display text-base font-medium text-text-primary line-clamp-2 leading-snug group-hover:text-brand-gold transition-colors duration-200">
            {product.name}
          </h3>

          {product.reviewCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "w-3 h-3",
                      star <= Math.round(parseDecimalPrice(product.averageRating))
                        ? "text-brand-gold fill-brand-gold"
                        : "text-border-default fill-border-default"
                    )}
                  />
                ))}
              </div>
              <span className="text-2xs text-text-muted">
                ({product.reviewCount})
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="font-body font-semibold text-text-primary text-sm">
              {formatPrice(displayPrice, currency)}
            </span>
            {comparePrice && comparePrice > displayPrice && (
              <span className="font-body text-sm text-text-muted line-through">
                {formatPrice(comparePrice, currency)}
              </span>
            )}
          </div>

          {product.variants.length > 0 && (
            <p className="text-2xs text-text-muted">
              {product.variants.length} variant{product.variants.length !== 1 ? "s" : ""} available
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
