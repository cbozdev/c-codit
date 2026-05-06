"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, ChevronDown, LayoutGrid, List } from "lucide-react";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ShopFilters } from "@/components/commerce/ShopFilters";
import { ShopPagination } from "@/components/commerce/ShopPagination";
import { ProductGridSkeleton } from "@/components/commerce/ProductGridSkeleton";
import { SORT_OPTIONS } from "@/config/products";
import type { ProductCardData, PaginatedResponse } from "@/types";
import type { ProductFilterInput } from "@/validators/product";
import { cn } from "@/lib/utils/cn";

type ShopPageClientProps = {
  initialProducts: ProductCardData[];
  initialMeta: PaginatedResponse<ProductCardData>["meta"];
  initialFilters: ProductFilterInput;
};

export function ShopPageClient({
  initialProducts,
  initialMeta,
  initialFilters,
}: ShopPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  const activeFilterCount = [
    initialFilters.category,
    initialFilters.origin,
    initialFilters.texture,
    initialFilters.laceType,
    initialFilters.density,
    initialFilters.minPrice,
    initialFilters.maxPrice,
    initialFilters.minLength,
    initialFilters.maxLength,
    initialFilters.q,
  ].filter(Boolean).length;

  const updateParams = useCallback(
    (updates: Partial<ProductFilterInput>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value == null || value === "" || (key === "page" && value === 1)) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      if (!("page" in updates)) params.delete("page");

      startTransition(() => {
        router.push(`/shop?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  const clearAllFilters = useCallback(() => {
    startTransition(() => {
      router.push("/shop");
    });
  }, [router]);

  const currentSort = initialFilters.sort ?? "newest";
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === currentSort)?.label ?? "New Arrivals";

  return (
    <div className="container-brand py-10 lg:py-16">
      {/* Page Header */}
      <div className="mb-8">
        <p className="text-label mb-1">Our Collection</p>
        <h1 className="font-display text-3xl lg:text-4xl font-medium text-text-primary">
          {initialFilters.q
            ? `Results for "${initialFilters.q}"`
            : initialFilters.category
            ? initialFilters.category
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())
            : "All Products"}
        </h1>
        <p className="text-text-muted text-sm mt-2">
          {initialMeta.total.toLocaleString()} product
          {initialMeta.total !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-6 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            icon={<SlidersHorizontal className="w-4 h-4" />}
          >
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="gold" size="sm" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-text-muted hover:text-brand-gold flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary border border-border-default rounded-xl px-3 py-2 transition-colors">
              <span>{sortLabel}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute top-full right-0 mt-2 w-52 bg-surface-elevated border border-border-subtle rounded-2xl shadow-elevation-3 overflow-hidden py-1.5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-20">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateParams({ sort: opt.value })}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm transition-colors",
                    opt.value === currentSort
                      ? "text-brand-gold bg-brand-gold/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Layout toggle */}
          <div className="hidden sm:flex items-center border border-border-default rounded-xl overflow-hidden">
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayout(mode)}
                className={cn(
                  "p-2 transition-colors",
                  layout === mode
                    ? "bg-brand-gold/10 text-brand-gold"
                    : "text-text-muted hover:text-text-primary"
                )}
                aria-label={`${mode} layout`}
              >
                {mode === "grid" ? (
                  <LayoutGrid className="w-4 h-4" />
                ) : (
                  <List className="w-4 h-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Filters */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.aside
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 280 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.25 }}
              className="hidden lg:block flex-shrink-0 overflow-hidden"
            >
              <ShopFilters
                filters={initialFilters}
                onUpdate={updateParams}
                onClose={() => setFiltersOpen(false)}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile Filters Drawer */}
        <AnimatePresence>
          {filtersOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-50 lg:hidden"
                onClick={() => setFiltersOpen(false)}
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed left-0 top-0 bottom-0 w-80 bg-surface-secondary z-60 lg:hidden overflow-y-auto"
              >
                <ShopFilters
                  filters={initialFilters}
                  onUpdate={updateParams}
                  onClose={() => setFiltersOpen(false)}
                  mobile
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Product Grid */}
        <div className="flex-1 min-w-0">
          {isPending ? (
            <ProductGridSkeleton />
          ) : initialProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <p className="font-display text-2xl font-medium text-text-primary">
                No products found
              </p>
              <p className="text-text-muted text-sm max-w-sm">
                Try adjusting your filters or search term to find what you're
                looking for.
              </p>
              <Button variant="secondary" size="md" onClick={clearAllFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  layout === "grid"
                    ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6"
                    : "flex flex-col gap-4"
                )}
              >
                {initialProducts.map((product, i) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={i < 4}
                  />
                ))}
              </div>

              <ShopPagination
                meta={initialMeta}
                onPageChange={(page) => updateParams({ page })}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
