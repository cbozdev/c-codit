import type { Metadata } from "next";
import { Suspense } from "react";
import { getProducts } from "@/domains/products/product.service";
import { productFilterSchema } from "@/validators/product";
import { ShopPageClient } from "./ShopPageClient";
import { ProductGridSkeleton } from "@/components/commerce/ProductGridSkeleton";

export const metadata: Metadata = {
  title: "Shop Premium Hair",
  description:
    "Browse our full collection of premium human hair wigs, bundles & extensions. Filter by texture, origin, length, density, and price.",
  openGraph: {
    title: "Shop Premium Hair | RI Hair Collectables",
    description: "Human hair wigs, bundles & extensions — Brazilian, Peruvian, Cambodian & Indian. Ships worldwide.",
  },
};

type ShopPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseSearchParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;

  const raw = {
    category: parseSearchParam(params["category"]),
    origin: parseSearchParam(params["origin"]),
    texture: parseSearchParam(params["texture"]),
    laceType: parseSearchParam(params["laceType"]),
    density: parseSearchParam(params["density"]),
    minPrice: parseSearchParam(params["minPrice"]),
    maxPrice: parseSearchParam(params["maxPrice"]),
    minLength: parseSearchParam(params["minLength"]),
    maxLength: parseSearchParam(params["maxLength"]),
    sort: parseSearchParam(params["sort"]) ?? "newest",
    page: parseSearchParam(params["page"]) ?? "1",
    limit: "24",
    q: parseSearchParam(params["q"]),
  };

  const filters = productFilterSchema.parse(raw);
  const { data: products, meta } = await getProducts(filters);

  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <ShopPageClient
        initialProducts={products}
        initialMeta={meta}
        initialFilters={filters}
      />
    </Suspense>
  );
}
