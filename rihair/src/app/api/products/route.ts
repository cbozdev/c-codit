import { NextRequest, NextResponse } from "next/server";
import { getProducts } from "@/domains/products/product.service";
import { productFilterSchema } from "@/validators/product";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const raw = Object.fromEntries(searchParams.entries());
    const filters = productFilterSchema.parse(raw);
    const result = await getProducts(filters);
    return NextResponse.json(result);
  } catch (err) {
    logger.error("GET /api/products failed", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}
