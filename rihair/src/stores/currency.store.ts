import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/config/currencies";
import type { SupportedCurrency, CurrencyConfig } from "@/types";

type CurrencyState = {
  currency: SupportedCurrency;
  rates: Record<string, number>;
  ratesLoadedAt: number | null;
};

type CurrencyActions = {
  setCurrency: (currency: SupportedCurrency) => void;
  setRates: (rates: Record<string, number>) => void;
  getConfig: () => CurrencyConfig;
  convert: (amount: number, from: SupportedCurrency) => number;
};

export const useCurrencyStore = create<CurrencyState & CurrencyActions>()(
  persist(
    (set, get) => ({
      currency: DEFAULT_CURRENCY,
      rates: {},
      ratesLoadedAt: null,

      setCurrency(currency) {
        set({ currency });
      },

      setRates(rates) {
        set({ rates, ratesLoadedAt: Date.now() });
      },

      getConfig() {
        return CURRENCIES[get().currency];
      },

      convert(amount, from) {
        const { currency, rates } = get();
        if (from === currency) return amount;
        const rateKey = `${from}_${currency}`;
        const rate = rates[rateKey];
        return rate ? Math.round(amount * rate * 100) / 100 : amount;
      },
    }),
    {
      name: "rihair-currency",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currency: state.currency,
        rates: state.rates,
        ratesLoadedAt: state.ratesLoadedAt,
      }),
    }
  )
);
