"use client";

import { useEffect, useState } from "react";
import { useCurrencyStore } from "@/stores/currency.store";
import { COUNTRY_CURRENCY_MAP } from "@/config/currencies";
import type { GeoLocation, SupportedCurrency } from "@/types";

const CACHE_KEY = "rihair_geo";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function useGeoLocation() {
  const [geo, setGeo] = useState<GeoLocation | null>(null);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { data: GeoLocation; ts: number };
        if (Date.now() - parsed.ts < CACHE_TTL_MS) {
          setGeo(parsed.data);
          return;
        }
      } catch {
        // stale or corrupt cache — fall through to fetch
      }
    }

    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: GeoLocation | null) => {
        if (!data) return;
        setGeo(data);
        const currency =
          COUNTRY_CURRENCY_MAP[data.countryCode] ?? ("USD" as SupportedCurrency);
        setCurrency(currency as SupportedCurrency);
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data, ts: Date.now() })
        );
      })
      .catch(() => null);
  }, [setCurrency]);

  return geo;
}
