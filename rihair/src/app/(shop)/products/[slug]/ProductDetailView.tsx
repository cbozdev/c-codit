"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  ShoppingBag,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Share2,
  Minus,
  Plus,
  Check,
  Truck,
  Shield,
  RefreshCw,
} from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useCurrencyStore } from "@/stores/currency.store";
import { formatPrice, parseDecimalPrice } from "@/lib/utils/currency";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StarRating } from "@/components/ui/StarRating";
import { GoldDivider } from "@/components/ui/GoldDivider";
import { cn } from "@/lib/utils/cn";
import { nanoid } from "nanoid";
import { DENSITIES } from "@/config/products";
import type { ProductWithRelations } from "@/types";
import type { ProductVariant, Review, User } from "@prisma/client";
import toast from "react-hot-toast";

type ReviewWithUser = Review & {
  user: Pick<User, "firstName" | "lastName" | "avatarUrl">;
};

type ProductDetailViewProps = {
  product: ProductWithRelations;
  reviews: ReviewWithUser[];
};

export function ProductDetailView({ product, reviews }: ProductDetailViewProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    product.variants[0] ?? null
  );
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);

  const addItem = useCartStore((s) => s.addItem);
  const { has: isWishlisted, toggle: toggleWishlist } = useWishlistStore();
  const { currency, convert } = useCurrencyStore();

  const basePrice = parseDecimalPrice(
    selectedVariant ? selectedVariant.price : product.basePrice
  );
  const comparePrice = selectedVariant?.compareAtPrice
    ? parseDecimalPrice(selectedVariant.compareAtPrice)
    : product.compareAtPrice
    ? parseDecimalPrice(product.compareAtPrice)
    : null;

  const displayPrice = convert(basePrice, product.currency as Parameters<typeof convert>[1]);
  const displayCompare = comparePrice
    ? convert(comparePrice, product.currency as Parameters<typeof convert>[1])
    : null;

  const discount = displayCompare
    ? Math.round(((displayCompare - displayPrice) / displayCompare) * 100)
    : 0;

  const inStock = selectedVariant
    ? selectedVariant.stockQuantity > 0
    : product.variants.some((v) => v.stockQuantity > 0);
  const stockQty = selectedVariant?.stockQuantity ?? 0;
  const lowStock = inStock && stockQty <= 5 && stockQty > 0;

  const uniqueLengths = [
    ...new Set(
      product.variants
        .map((v) => v.lengthInches)
        .filter(Boolean)
        .sort((a, b) => (a ?? 0) - (b ?? 0))
    ),
  ];
  const uniqueDensities = [...new Set(product.variants.map((v) => v.density).filter(Boolean))];
  const uniqueColors = [...new Set(product.variants.map((v) => v.color).filter(Boolean))];

  const [selectedLength, setSelectedLength] = useState<number | null>(
    selectedVariant?.lengthInches ?? null
  );
  const [selectedDensity, setSelectedDensity] = useState<string | null>(
    selectedVariant?.density ?? null
  );
  const [selectedColor, setSelectedColor] = useState<string | null>(
    selectedVariant?.color ?? null
  );

  const findVariant = useCallback(
    (length: number | null, density: string | null, color: string | null) => {
      return (
        product.variants.find(
          (v) =>
            (length == null || v.lengthInches === length) &&
            (density == null || v.density === density) &&
            (color == null || v.color === color)
        ) ?? null
      );
    },
    [product.variants]
  );

  const handleLengthSelect = (length: number) => {
    setSelectedLength(length);
    const variant = findVariant(length, selectedDensity, selectedColor);
    if (variant) setSelectedVariant(variant);
  };

  const handleDensitySelect = (density: string) => {
    setSelectedDensity(density);
    const variant = findVariant(selectedLength, density, selectedColor);
    if (variant) setSelectedVariant(variant);
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    const variant = findVariant(selectedLength, selectedDensity, color);
    if (variant) setSelectedVariant(variant);
  };

  const handleAddToCart = useCallback(() => {
    if (!inStock) return;
    addItem({
      id: nanoid(),
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        requiresShipping: product.requiresShipping,
        primaryImage: product.images.find((i) => i.isPrimary)?.url ?? product.images[0]?.url ?? null,
      },
      variant: selectedVariant
        ? {
            id: selectedVariant.id,
            sku: selectedVariant.sku,
            price: selectedVariant.price,
            stockQuantity: selectedVariant.stockQuantity,
            color: selectedVariant.color ?? null,
            lengthInches: selectedVariant.lengthInches ?? null,
            density: selectedVariant.density ?? null,
          }
        : null,
      quantity,
      unitPrice: displayPrice,
      lineTotal: displayPrice * quantity,
    });

    setAddedToCart(true);
    toast.success("Added to your bag!");
    setTimeout(() => setAddedToCart(false), 2500);
  }, [addItem, product, selectedVariant, quantity, displayPrice, inStock]);

  const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
    `Hi! I'm interested in: ${product.name} — ${window?.location?.href ?? ""}`
  )}`;

  const images = product.images.length > 0
    ? product.images
    : [{ url: "", altText: product.name, id: "placeholder" }];

  return (
    <div className="container-brand py-10 lg:py-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-text-muted mb-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-text-secondary transition-colors">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-text-secondary transition-colors">Shop</Link>
        <span>/</span>
        <Link
          href={`/shop?category=${product.category.slug}`}
          className="hover:text-text-secondary transition-colors"
        >
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-text-secondary truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Image Gallery */}
        <div className="space-y-4">
          <div className="relative aspect-[4/5] bg-surface-secondary rounded-2xl overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedImage}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                {images[selectedImage]?.url ? (
                  <Image
                    src={images[selectedImage]!.url}
                    alt={images[selectedImage]?.altText ?? product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted">
                    No image
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {images.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setSelectedImage((i) => (i - 1 + images.length) % images.length)
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 btn-icon shadow-elevation-2"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    setSelectedImage((i) => (i + 1) % images.length)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon shadow-elevation-2"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {product.isNewArrival && (
              <div className="absolute top-4 left-4">
                <Badge variant="new">New Arrival</Badge>
              </div>
            )}
            {discount > 0 && (
              <div className="absolute top-4 right-4">
                <Badge variant="sale">–{discount}%</Badge>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "relative w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-colors duration-200",
                    i === selectedImage
                      ? "border-brand-gold"
                      : "border-transparent hover:border-border-default"
                  )}
                  aria-label={`View image ${i + 1}`}
                  aria-pressed={i === selectedImage}
                >
                  {img.url && (
                    <Image
                      src={img.url}
                      alt={img.altText ?? product.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/shop?category=${product.category.slug}`}
                className="text-label hover:text-brand-gold-light transition-colors"
              >
                {product.category.name}
              </Link>
              {product.isBestSeller && (
                <Badge variant="gold">Best Seller</Badge>
              )}
            </div>

            <h1 className="font-display text-3xl lg:text-4xl font-medium text-text-primary leading-tight mb-3">
              {product.name}
            </h1>

            {product.reviewCount > 0 && (
              <div className="flex items-center gap-3">
                <StarRating
                  rating={parseDecimalPrice(product.averageRating)}
                  size="md"
                />
                <span className="text-sm text-text-muted">
                  {product.reviewCount} review{product.reviewCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="font-display text-3xl font-medium text-text-primary">
              {formatPrice(displayPrice, currency)}
            </span>
            {displayCompare && displayCompare > displayPrice && (
              <span className="text-text-muted line-through text-lg">
                {formatPrice(displayCompare, currency)}
              </span>
            )}
          </div>

          <GoldDivider />

          {/* Variant Selectors */}
          {uniqueLengths.length > 0 && (
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2.5">
                Length:{" "}
                {selectedLength && (
                  <span className="text-text-primary font-semibold">
                    {selectedLength}&quot;
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {uniqueLengths.map((length) => {
                  const available = product.variants.some(
                    (v) => v.lengthInches === length && v.stockQuantity > 0
                  );
                  return (
                    <button
                      key={length}
                      onClick={() => handleLengthSelect(length!)}
                      disabled={!available}
                      className={cn(
                        "w-14 h-10 rounded-xl border text-sm font-medium transition-all duration-200",
                        selectedLength === length
                          ? "bg-brand-gold/20 border-brand-gold text-brand-gold"
                          : available
                          ? "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
                          : "border-border-subtle text-text-muted opacity-40 cursor-not-allowed line-through"
                      )}
                    >
                      {length}&quot;
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {uniqueDensities.length > 0 && (
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2.5">
                Density:{" "}
                {selectedDensity && (
                  <span className="text-text-primary font-semibold">
                    {DENSITIES.find((d) => d.value === selectedDensity)?.label}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {uniqueDensities.map((density) => (
                  <button
                    key={density}
                    onClick={() => handleDensitySelect(density!)}
                    className={cn(
                      "px-4 h-10 rounded-xl border text-sm font-medium transition-all duration-200",
                      selectedDensity === density
                        ? "bg-brand-gold/20 border-brand-gold text-brand-gold"
                        : "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
                    )}
                  >
                    {DENSITIES.find((d) => d.value === density)?.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {uniqueColors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-text-secondary mb-2.5">
                Colour:{" "}
                {selectedColor && (
                  <span className="text-text-primary font-semibold">
                    {selectedColor}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {uniqueColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color!)}
                    className={cn(
                      "px-4 h-10 rounded-xl border text-sm font-medium transition-all duration-200",
                      selectedColor === color
                        ? "bg-brand-gold/20 border-brand-gold text-brand-gold"
                        : "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + CTA */}
          <div className="space-y-3">
            {lowStock && (
              <p className="text-sm text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                Only {stockQty} left in stock — order soon
              </p>
            )}
            {!inStock && (
              <p className="text-sm text-text-muted">
                This variant is currently out of stock.
              </p>
            )}

            <div className="flex gap-3">
              <div className="flex items-center border border-border-default rounded-full">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center text-sm font-semibold text-text-primary">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity((q) => Math.min(stockQty || 10, q + 1))
                  }
                  className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!inStock}
                onClick={handleAddToCart}
                icon={
                  addedToCart ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <ShoppingBag className="w-5 h-5" />
                  )
                }
                className={addedToCart ? "bg-emerald-500 hover:bg-emerald-500" : ""}
              >
                {addedToCart ? "Added!" : inStock ? "Add to Bag" : "Out of Stock"}
              </Button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => toggleWishlist(product.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-11 rounded-full border text-sm font-medium transition-all duration-200",
                  isWishlisted(product.id)
                    ? "bg-brand-gold/10 border-brand-gold text-brand-gold"
                    : "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
                )}
              >
                <Heart
                  className="w-4 h-4"
                  fill={isWishlisted(product.id) ? "currentColor" : "none"}
                />
                {isWishlisted(product.id) ? "Saved" : "Wishlist"}
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full border border-border-default text-sm font-medium text-text-secondary hover:border-[#25D366] hover:text-[#25D366] transition-all duration-200"
              >
                <MessageCircle className="w-4 h-4" />
                Enquire
              </a>
            </div>
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { icon: Truck, text: "Free shipping over $150" },
              { icon: Shield, text: "Quality guaranteed" },
              { icon: RefreshCw, text: "Easy returns" },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex flex-col items-center gap-1.5 text-center p-3 rounded-xl bg-surface-secondary"
              >
                <Icon className="w-4 h-4 text-brand-gold" />
                <span className="text-2xs text-text-muted leading-tight">{text}</span>
              </div>
            ))}
          </div>

          {/* Product Details Accordion */}
          <div className="border-t border-border-subtle pt-6 space-y-4">
            {product.shortDescription && (
              <p className="text-sm text-text-secondary leading-relaxed">
                {product.shortDescription}
              </p>
            )}

            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-text-primary list-none">
                Product Details
                <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="mt-3 text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {product.description}
              </div>
            </details>

            {(product.hairOrigin || product.hairTexture || product.laceType) && (
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-text-primary list-none">
                  Specifications
                  <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="mt-3 space-y-2">
                  {product.hairOrigin && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Origin</span>
                      <span className="text-text-secondary capitalize">
                        {product.hairOrigin.toLowerCase()}
                      </span>
                    </div>
                  )}
                  {product.hairTexture && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Texture</span>
                      <span className="text-text-secondary">
                        {product.hairTexture.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </div>
                  )}
                  {product.laceType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-text-muted">Lace Type</span>
                      <span className="text-text-secondary">
                        {product.laceType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      {reviews.length > 0 && (
        <div className="mt-16 lg:mt-24">
          <GoldDivider label="Customer Reviews" className="mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((review) => (
              <div key={review.id} className="card-elevated p-5 space-y-3">
                <StarRating rating={review.rating} size="sm" />
                {review.title && (
                  <p className="text-sm font-semibold text-text-primary">
                    {review.title}
                  </p>
                )}
                <p className="text-sm text-text-secondary leading-relaxed line-clamp-4">
                  {review.body}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-brand-black">
                      {review.user.firstName?.charAt(0) ?? "?"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">
                      {review.user.firstName} {review.user.lastName}
                    </p>
                    {review.isVerified && (
                      <p className="text-2xs text-brand-gold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Verified Purchase
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
