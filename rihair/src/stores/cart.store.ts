import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { CartItemData, CartSummary, SupportedCurrency } from "@/types";

type CartState = {
  items: CartItemData[];
  currency: SupportedCurrency;
  couponCode: string | null;
  couponDiscount: number;
  isOpen: boolean;
};

type CartActions = {
  addItem: (item: CartItemData) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  removeCoupon: () => void;
  setCurrency: (currency: SupportedCurrency) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  getSummary: (shipping?: number, tax?: number) => CartSummary;
};

export const useCartStore = create<CartState & CartActions>()(
  persist(
    immer((set, get) => ({
      items: [],
      currency: "USD",
      couponCode: null,
      couponDiscount: 0,
      isOpen: false,

      addItem(newItem) {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) =>
              i.productId === newItem.productId &&
              i.variantId === newItem.variantId
          );

          if (existingIndex >= 0) {
            const existing = state.items[existingIndex];
            if (existing) {
              existing.quantity += newItem.quantity;
              existing.lineTotal = existing.quantity * existing.unitPrice;
            }
          } else {
            state.items.push(newItem);
          }

          state.isOpen = true;
        });
      },

      removeItem(itemId) {
        set((state) => {
          state.items = state.items.filter((i) => i.id !== itemId);
        });
      },

      updateQuantity(itemId, quantity) {
        set((state) => {
          const item = state.items.find((i) => i.id === itemId);
          if (item) {
            if (quantity <= 0) {
              state.items = state.items.filter((i) => i.id !== itemId);
            } else {
              item.quantity = quantity;
              item.lineTotal = quantity * item.unitPrice;
            }
          }
        });
      },

      clearCart() {
        set((state) => {
          state.items = [];
          state.couponCode = null;
          state.couponDiscount = 0;
        });
      },

      applyCoupon(code, discount) {
        set((state) => {
          state.couponCode = code;
          state.couponDiscount = discount;
        });
      },

      removeCoupon() {
        set((state) => {
          state.couponCode = null;
          state.couponDiscount = 0;
        });
      },

      setCurrency(currency) {
        set((state) => {
          state.currency = currency;
        });
      },

      openCart() {
        set((state) => { state.isOpen = true; });
      },

      closeCart() {
        set((state) => { state.isOpen = false; });
      },

      toggleCart() {
        set((state) => { state.isOpen = !state.isOpen; });
      },

      getSummary(shipping = 0, tax = 0): CartSummary {
        const { items, couponDiscount, currency } = get();
        const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
        const total = subtotal - couponDiscount + shipping + tax;

        return {
          items,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
          subtotal,
          discount: couponDiscount,
          shipping,
          tax,
          total: Math.max(0, total),
          currency,
        };
      },
    })),
    {
      name: "rihair-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        currency: state.currency,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
      }),
    }
  )
);

export const useCartItemCount = () =>
  useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));

export const useCartTotal = () =>
  useCartStore((s) => s.items.reduce((sum, i) => sum + i.lineTotal, 0));
