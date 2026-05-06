"use client";

import { useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight } from "lucide-react";
import { useCartStore, useCartTotal } from "@/stores/cart.store";
import { useCurrencyStore } from "@/stores/currency.store";
import { formatPrice, parseDecimalPrice } from "@/lib/utils/currency";
import { Button } from "@/components/ui/Button";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity } = useCartStore();
  const cartTotal = useCartTotal();
  const { currency } = useCurrencyStore();

  const handleQuantityChange = useCallback(
    (itemId: string, currentQty: number, delta: number) => {
      updateQuantity(itemId, currentQty + delta);
    },
    [updateQuantity]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-surface-secondary border-l border-border-subtle z-70 flex flex-col shadow-elevation-4"
            role="dialog"
            aria-label="Shopping bag"
            aria-modal
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-brand-gold" />
                <h2 className="font-display text-lg font-medium text-text-primary">
                  Your Bag
                </h2>
                {items.length > 0 && (
                  <span className="text-sm text-text-muted">
                    ({items.length} item{items.length !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="btn-icon"
                aria-label="Close cart"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-6 py-16">
                  <div className="w-20 h-20 rounded-full bg-surface-tertiary flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 text-text-muted" />
                  </div>
                  <div className="text-center">
                    <p className="font-display text-lg font-medium text-text-primary mb-1">
                      Your bag is empty
                    </p>
                    <p className="text-sm text-text-muted">
                      Add something beautiful to get started.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={onClose}
                    icon={<ArrowRight className="w-4 h-4" />}
                    iconPosition="right"
                  >
                    <Link href="/shop">Shop Now</Link>
                  </Button>
                </div>
              ) : (
                <ul className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => (
                      <motion.li
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex gap-4"
                      >
                        <Link
                          href={`/products/${item.product.slug}`}
                          onClick={onClose}
                          className="relative w-20 h-24 rounded-xl overflow-hidden bg-surface-tertiary flex-shrink-0"
                        >
                          {item.product.primaryImage && (
                            <Image
                              src={item.product.primaryImage}
                              alt={item.product.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          )}
                        </Link>

                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/products/${item.product.slug}`}
                            onClick={onClose}
                            className="font-medium text-sm text-text-primary hover:text-brand-gold transition-colors line-clamp-2 leading-snug block"
                          >
                            {item.product.name}
                          </Link>

                          {item.variant && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {item.variant.lengthInches && (
                                <span className="text-2xs text-text-muted border border-border-subtle rounded-full px-2 py-0.5">
                                  {item.variant.lengthInches}&quot;
                                </span>
                              )}
                              {item.variant.density && (
                                <span className="text-2xs text-text-muted border border-border-subtle rounded-full px-2 py-0.5">
                                  {item.variant.density.replace("DENSITY_", "")}%
                                </span>
                              )}
                              {item.variant.color && (
                                <span className="text-2xs text-text-muted border border-border-subtle rounded-full px-2 py-0.5">
                                  {item.variant.color}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-1 border border-border-default rounded-full">
                              <button
                                onClick={() =>
                                  handleQuantityChange(item.id, item.quantity, -1)
                                }
                                className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-full"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-medium text-text-primary w-6 text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  handleQuantityChange(item.id, item.quantity, 1)
                                }
                                className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors rounded-full"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-text-primary">
                                {formatPrice(item.lineTotal, currency)}
                              </span>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-feedback-error transition-colors rounded-full"
                                aria-label="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-border-subtle px-6 py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Subtotal</span>
                  <span className="font-semibold text-text-primary">
                    {formatPrice(cartTotal, currency)}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Shipping & taxes calculated at checkout
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  icon={<ArrowRight className="w-5 h-5" />}
                  iconPosition="right"
                  onClick={onClose}
                >
                  <Link href="/checkout">Checkout</Link>
                </Button>
                <button
                  onClick={onClose}
                  className="w-full text-sm text-text-muted hover:text-text-secondary transition-colors text-center"
                >
                  Continue Shopping
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
