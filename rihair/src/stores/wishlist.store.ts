import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type WishlistState = {
  productIds: Set<string>;
};

type WishlistActions = {
  add: (productId: string) => void;
  remove: (productId: string) => void;
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
};

export const useWishlistStore = create<WishlistState & WishlistActions>()(
  persist(
    (set, get) => ({
      productIds: new Set(),

      add(productId) {
        set((state) => ({
          productIds: new Set([...state.productIds, productId]),
        }));
      },

      remove(productId) {
        set((state) => {
          const next = new Set(state.productIds);
          next.delete(productId);
          return { productIds: next };
        });
      },

      toggle(productId) {
        get().has(productId) ? get().remove(productId) : get().add(productId);
      },

      has(productId) {
        return get().productIds.has(productId);
      },

      clear() {
        set({ productIds: new Set() });
      },
    }),
    {
      name: "rihair-wishlist",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        productIds: [...state.productIds],
      }),
      merge: (persisted, current) => ({
        ...current,
        productIds: new Set(
          (persisted as { productIds: string[] }).productIds ?? []
        ),
      }),
    }
  )
);
