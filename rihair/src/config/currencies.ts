import type { CurrencyConfig, SupportedCurrency } from "@/types";

export const CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  NGN: {
    code: "NGN",
    symbol: "₦",
    name: "Nigerian Naira",
    locale: "en-NG",
    fractionDigits: 0,
  },
  GHS: {
    code: "GHS",
    symbol: "₵",
    name: "Ghanaian Cedi",
    locale: "en-GH",
    fractionDigits: 2,
  },
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    locale: "en-US",
    fractionDigits: 2,
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    locale: "en-GB",
    fractionDigits: 2,
  },
  CAD: {
    code: "CAD",
    symbol: "CA$",
    name: "Canadian Dollar",
    locale: "en-CA",
    fractionDigits: 2,
  },
};

export const COUNTRY_CURRENCY_MAP: Record<string, SupportedCurrency> = {
  NG: "NGN",
  GH: "GHS",
  GB: "GBP",
  US: "USD",
  CA: "CAD",
};

export const WEST_AFRICA_COUNTRIES = ["NG", "GH", "SN", "CI", "CM", "KE", "TZ", "ZA"];

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";
