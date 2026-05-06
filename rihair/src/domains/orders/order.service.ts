import { prisma } from "@/lib/db/prisma";
import { generateOrderNumber } from "@/lib/utils/slug";
import { logger } from "@/lib/logger";
import type { CheckoutInput } from "@/validators/checkout";
import type { CartItemData, SupportedCurrency } from "@/types";
import type { OrderStatus } from "@prisma/client";

type CreateOrderParams = {
  userId?: string;
  guestEmail?: string;
  items: CartItemData[];
  checkout: CheckoutInput;
  shippingAmount: number;
  discountAmount: number;
  taxAmount: number;
  currency: SupportedCurrency;
  ipAddress?: string;
  userAgent?: string;
};

export async function createOrder(params: CreateOrderParams) {
  const subtotal = params.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = subtotal + params.shippingAmount + params.taxAmount - params.discountAmount;

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: params.userId,
        guestEmail: params.guestEmail,
        status: "PENDING",
        currency: params.currency,
        subtotal,
        discountAmount: params.discountAmount,
        shippingAmount: params.shippingAmount,
        taxAmount: params.taxAmount,
        total,
        shippingSnapshot: params.checkout.shippingAddress,
        billingSnapshot: params.checkout.sameAsShipping
          ? params.checkout.shippingAddress
          : params.checkout.billingAddress,
        couponCode: params.checkout.couponCode || null,
        notes: params.checkout.notes || null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        items: {
          create: params.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.product.name,
            variantDetails: item.variant
              ? {
                  color: item.variant.color,
                  lengthInches: item.variant.lengthInches,
                  density: item.variant.density,
                  sku: item.variant.sku,
                }
              : null,
            imageUrl: item.product.primaryImage,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.lineTotal,
          })),
        },
        timeline: {
          create: {
            status: "PENDING",
            description: "Order placed successfully",
          },
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            variant: true,
          },
        },
      },
    });

    for (const item of params.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }
    }

    if (params.checkout.couponCode && params.userId) {
      const coupon = await tx.coupon.findUnique({
        where: { code: params.checkout.couponCode },
      });
      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });
        await tx.couponUsage.create({
          data: {
            couponId: coupon.id,
            userId: params.userId,
            orderId: newOrder.id,
          },
        });
      }
    }

    if (params.userId) {
      await tx.cartItem.deleteMany({ where: { userId: params.userId } });
    }

    return newOrder;
  });

  logger.info("Order created", { orderId: order.id, orderNumber: order.orderNumber });

  return order;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  description: string,
  updatedBy?: string
) {
  const [order] = await Promise.all([
    prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(status === "PAYMENT_CONFIRMED" ? { paidAt: new Date() } : {}),
        ...(status === "SHIPPED" ? { shippedAt: new Date() } : {}),
        ...(status === "DELIVERED" ? { deliveredAt: new Date() } : {}),
        timeline: {
          create: {
            status,
            description,
            createdBy: updatedBy,
          },
        },
      },
    }),
  ]);

  return order;
}

export async function getOrderById(orderId: string, userId?: string) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      ...(userId ? { userId } : {}),
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true },
              },
            },
          },
          variant: true,
        },
      },
      payment: true,
      shipment: true,
      timeline: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function getCustomerOrders(userId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [total, orders] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          take: 3,
          include: {
            product: {
              select: {
                name: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        },
        payment: { select: { status: true, provider: true } },
        shipment: { select: { trackingNumber: true, carrier: true, status: true } },
      },
    }),
  ]);

  return {
    data: orders,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
}
