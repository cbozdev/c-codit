"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowRight, TrendingUp } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { formatPrice, parseDecimalPrice } from "@/lib/utils/currency";
import { useCurrencyStore } from "@/stores/currency.store";
import type { ProductCardData } from "@/types";

type SearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const TRENDING_SEARCHES = [
  "HD lace wig",
  "Brazilian body wave",
  "28 inch wig",
  "Peruvian straight",
  "Cambodian curly",
  "Frontal wig 150 density",
];

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductCardData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);
  const { currency } = useCurrencyStore();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/products?q=${encodeURIComponent(q)}&limit=5`
      );
      if (response.ok) {
        const data = await response.json();
        setResults(data.data ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-2xl z-70"
            role="dialog"
            aria-label="Search"
            aria-modal
          >
            <div className="bg-surface-elevated border border-border-default rounded-2xl shadow-elevation-4 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border-subtle">
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <Search className="w-5 h-5 text-text-muted flex-shrink-0" />
                )}
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for wigs, bundles, textures..."
                  className="flex-1 bg-transparent text-text-primary placeholder-text-muted text-sm focus:outline-none"
                  aria-label="Search products"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="text-text-muted hover:text-text-primary transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-xs text-text-muted border border-border-subtle px-2 py-1 rounded"
                  aria-label="Close search"
                >
                  ESC
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                {!query && (
                  <div className="p-5">
                    <p className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Trending Searches
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TRENDING_SEARCHES.map((term) => (
                        <button
                          key={term}
                          onClick={() => setQuery(term)}
                          className="text-sm text-text-secondary border border-border-default rounded-full px-3 py-1.5 hover:border-brand-gold hover:text-brand-gold transition-colors duration-200"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {query && results.length > 0 && (
                  <div className="py-2">
                    <p className="px-5 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      Products
                    </p>
                    <ul>
                      {results.map((product) => (
                        <li key={product.id}>
                          <Link
                            href={`/products/${product.slug}`}
                            onClick={onClose}
                            className="flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors group"
                          >
                            <div className="relative w-12 h-14 rounded-lg bg-surface-tertiary flex-shrink-0 overflow-hidden">
                              {product.primaryImage && (
                                <Image
                                  src={product.primaryImage}
                                  alt={product.name}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text-primary group-hover:text-brand-gold transition-colors truncate">
                                {product.name}
                              </p>
                              <p className="text-xs text-text-muted truncate">
                                {product.category.name}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-brand-gold flex-shrink-0">
                              {formatPrice(
                                parseDecimalPrice(product.basePrice),
                                currency
                              )}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>

                    <div className="px-5 py-3 border-t border-border-subtle">
                      <Link
                        href={`/shop?q=${encodeURIComponent(query)}`}
                        onClick={onClose}
                        className="flex items-center justify-between text-sm text-brand-gold font-semibold hover:gap-3 group transition-all"
                      >
                        <span>
                          View all results for &ldquo;{query}&rdquo;
                        </span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                )}

                {query && results.length === 0 && !isLoading && (
                  <div className="px-5 py-10 text-center">
                    <p className="text-text-muted text-sm">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-text-muted text-xs mt-1">
                      Try a different search term
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
