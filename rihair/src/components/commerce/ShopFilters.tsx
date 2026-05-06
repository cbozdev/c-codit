"use client";

import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  HAIR_ORIGINS,
  HAIR_TEXTURES,
  LACE_TYPES,
  DENSITIES,
  LENGTHS,
} from "@/config/products";
import type { ProductFilterInput } from "@/validators/product";

type ShopFiltersProps = {
  filters: ProductFilterInput;
  onUpdate: (updates: Partial<ProductFilterInput>) => void;
  onClose: () => void;
  mobile?: boolean;
};

type FilterSectionProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border-subtle py-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-semibold text-text-primary mb-1"
      >
        {title}
        {open ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function ShopFilters({
  filters,
  onUpdate,
  onClose,
  mobile,
}: ShopFiltersProps) {
  return (
    <div className={cn("space-y-0", mobile && "p-5")}>
      <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
        <h3 className="font-display text-lg font-medium text-text-primary">
          Filters
        </h3>
        <button
          onClick={onClose}
          className="btn-icon"
          aria-label="Close filters"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hair Origin */}
      <FilterSection title="Hair Origin">
        <div className="flex flex-wrap gap-2">
          {HAIR_ORIGINS.map((o) => (
            <button
              key={o.value}
              onClick={() =>
                onUpdate({
                  origin: filters.origin === o.value ? undefined : (o.value as ProductFilterInput["origin"]),
                })
              }
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors duration-200",
                filters.origin === o.value
                  ? "bg-brand-gold/20 border-brand-gold text-brand-gold"
                  : "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Texture */}
      <FilterSection title="Texture">
        <div className="flex flex-wrap gap-2">
          {HAIR_TEXTURES.map((t) => (
            <button
              key={t.value}
              onClick={() =>
                onUpdate({
                  texture: filters.texture === t.value ? undefined : (t.value as ProductFilterInput["texture"]),
                })
              }
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors duration-200",
                filters.texture === t.value
                  ? "bg-brand-gold/20 border-brand-gold text-brand-gold"
                  : "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Lace Type */}
      <FilterSection title="Lace Type">
        <div className="flex flex-wrap gap-2">
          {LACE_TYPES.map((l) => (
            <button
              key={l.value}
              onClick={() =>
                onUpdate({
                  laceType: filters.laceType === l.value ? undefined : (l.value as ProductFilterInput["laceType"]),
                })
              }
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors duration-200",
                filters.laceType === l.value
                  ? "bg-brand-gold/20 border-brand-gold text-brand-gold"
                  : "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Density */}
      <FilterSection title="Density">
        <div className="flex flex-wrap gap-2">
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              onClick={() =>
                onUpdate({
                  density: filters.density === d.value ? undefined : (d.value as ProductFilterInput["density"]),
                })
              }
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors duration-200",
                filters.density === d.value
                  ? "bg-brand-gold/20 border-brand-gold text-brand-gold"
                  : "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Length Range */}
      <FilterSection title="Length (inches)" defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {LENGTHS.map((l) => {
            const val = Number(l.value);
            const inRange =
              (filters.minLength == null || val >= filters.minLength) &&
              (filters.maxLength == null || val <= filters.maxLength);
            const active =
              filters.minLength != null || filters.maxLength != null
                ? inRange
                : false;
            return (
              <button
                key={l.value}
                onClick={() => {
                  if (filters.minLength === val && filters.maxLength === val) {
                    onUpdate({ minLength: undefined, maxLength: undefined });
                  } else {
                    onUpdate({ minLength: val, maxLength: val });
                  }
                }}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border transition-colors duration-200",
                  active
                    ? "bg-brand-gold/20 border-brand-gold text-brand-gold"
                    : "border-border-default text-text-secondary hover:border-brand-gold/50 hover:text-text-primary"
                )}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection title="Price Range" defaultOpen={false}>
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice ?? ""}
            onChange={(e) =>
              onUpdate({ minPrice: e.target.value ? Number(e.target.value) : undefined })
            }
            className="input-field text-sm py-2"
            min={0}
          />
          <span className="text-text-muted text-sm flex-shrink-0">to</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice ?? ""}
            onChange={(e) =>
              onUpdate({ maxPrice: e.target.value ? Number(e.target.value) : undefined })
            }
            className="input-field text-sm py-2"
            min={0}
          />
        </div>
      </FilterSection>
    </div>
  );
}
