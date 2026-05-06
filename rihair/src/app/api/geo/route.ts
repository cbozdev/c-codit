import { NextRequest, NextResponse } from "next/server";
import { COUNTRY_CURRENCY_MAP, WEST_AFRICA_COUNTRIES } from "@/config/currencies";
import type { GeoLocation } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1";

  const cfCountry = request.headers.get("cf-ipcountry");
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  const countryCode = cfCountry ?? vercelCountry ?? "US";

  const currency = COUNTRY_CURRENCY_MAP[countryCode] ?? "USD";
  const isWestAfrica = WEST_AFRICA_COUNTRIES.includes(countryCode);

  const geo: GeoLocation = {
    country: countryCode,
    countryCode,
    region: countryCode,
    currency,
    timezone: "UTC",
    paymentRegion: isWestAfrica ? "west_africa" : "international",
  };

  return NextResponse.json(geo, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
