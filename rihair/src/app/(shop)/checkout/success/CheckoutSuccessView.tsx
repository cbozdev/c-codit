"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle, Package, MessageCircle, ArrowRight } from "lucide-react";
import { useCurrencyStore } from "@/stores/currency.store";
import { useCartStore } from "@/stores/cart.store";
import type { Prisma } from "@prisma/client";

type OrderWithDetails = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: { select: { name: true; slug: true } };
        variant: { select: { lengthInches: true; density: true; color: true } };
      };
    };
    shippingAddress: true;
  };
}>;

interface Props {
  order: OrderWithDetails;
}

export function CheckoutSuccessView({ order }: Props) {
  const { convert, currency } = useCurrencyStore();
  const clearCart = useCartStore((s) => s.clearCart);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  const total =
    typeof order.total === "object" && "toNumber" in order.total
      ? (order.total as unknown as { toNumber(): number }).toNumber()
      : Number(order.total);

  const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""}?text=${encodeURIComponent(
    `Hi! I just placed order #${order.orderNumber}. Can you confirm receipt?`
  )}`;

  return (
    <div className="min-h-screen bg-[#FAFAF8] py-16">
      <div className="container-brand max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 mb-6"
          >
            <CheckCircle className="w-10 h-10 text-green-600" />
          </motion.div>

          <h1 className="font-cormorant text-4xl font-semibold text-[#0A0A0A] mb-3">
            Order Confirmed!
          </h1>
          <p className="text-neutral-500 text-lg">
            Thank you for shopping with RI Hair Collectables.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-elevated p-8 mb-6"
        >
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-neutral-100">
            <div>
              <p className="text-sm text-neutral-400 uppercase tracking-wider mb-1">Order Number</p>
              <p className="font-mono font-semibold text-[#0A0A0A] text-lg">
                #{order.orderNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-400 uppercase tracking-wider mb-1">Total</p>
              <p className="font-semibold text-[#0A0A0A] text-lg">
                {convert(total, currency)}
              </p>
            </div>
          </div>

          <h2 className="font-medium text-[#0A0A0A] mb-4">Items Ordered</h2>
          <ul className="space-y-3 mb-6">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between items-start text-sm">
                <div>
                  <p className="font-medium text-[#0A0A0A]">{item.product.name}</p>
                  {item.variant && (
                    <p className="text-neutral-400">
                      {[
                        item.variant.lengthInches && `${item.variant.lengthInches}"`,
                        item.variant.density?.replace("DENSITY_", "") &&
                          `${item.variant.density.replace("DENSITY_", "")}%`,
                        item.variant.color,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <span className="text-neutral-500 ml-4">×{item.quantity}</span>
              </li>
            ))}
          </ul>

          {order.shippingAddress && (
            <div className="pt-6 border-t border-neutral-100">
              <h2 className="font-medium text-[#0A0A0A] mb-2">Shipping To</h2>
              <p className="text-sm text-neutral-500">
                {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                <br />
                {order.shippingAddress.addressLine1}
                {order.shippingAddress.addressLine2 && `, ${order.shippingAddress.addressLine2}`}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                {order.shippingAddress.postalCode}
                <br />
                {order.shippingAddress.country}
              </p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-xl p-5 mb-8"
        >
          <div className="flex gap-3">
            <Package className="w-5 h-5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-[#0A0A0A] mb-1">What happens next?</p>
              <p className="text-neutral-500">
                You will receive a confirmation email shortly. Your order will be processed and
                dispatched within 1–2 business days. You can track your order from your account
                dashboard.
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link href="/dashboard" className="btn-primary flex-1 justify-center">
            View My Orders
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-1 justify-center"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp Us
          </a>
          <Link href="/shop" className="btn-ghost flex-1 justify-center">
            Continue Shopping
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
