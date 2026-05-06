"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PaginatedResponse } from "@/types";

type PaginationProps = {
  meta: PaginatedResponse<unknown>["meta"];
  onPageChange: (page: number) => void;
};

export function ShopPagination({ meta, onPageChange }: PaginationProps) {
  if (meta.totalPages <= 1) return null;

  const pages = buildPageRange(meta.page, meta.totalPages);

  return (
    <nav
      className="flex items-center justify-center gap-2 mt-12"
      aria-label="Pagination"
    >
      <button
        onClick={() => onPageChange(meta.page - 1)}
        disabled={!meta.hasPrevPage}
        className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pages.map((page, i) =>
        page === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-text-muted text-sm">
            …
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(Number(page))}
            aria-current={page === meta.page ? "page" : undefined}
            className={cn(
              "w-10 h-10 rounded-full text-sm font-medium transition-colors duration-200",
              page === meta.page
                ? "bg-brand-gold text-brand-black"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5 border border-transparent hover:border-border-default"
            )}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(meta.page + 1)}
        disabled={!meta.hasNextPage}
        className="btn-icon disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}

function buildPageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const range: (number | "…")[] = [];

  if (current <= 4) {
    range.push(1, 2, 3, 4, 5, "…", total);
  } else if (current >= total - 3) {
    range.push(1, "…", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    range.push(1, "…", current - 1, current, current + 1, "…", total);
  }

  return range;
}
