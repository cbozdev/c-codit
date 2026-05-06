"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingBag,
  User,
  Heart,
  Menu,
  X,
  ChevronDown,
  Globe,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils/cn";
import { useCartItemCount } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";
import { useCurrencyStore } from "@/stores/currency.store";
import { CURRENCIES } from "@/config/currencies";
import { CartDrawer } from "@/components/commerce/CartDrawer";
import { SearchModal } from "@/components/commerce/SearchModal";
import type { SupportedCurrency } from "@/types";

const NAV_LINKS = [
  {
    label: "Shop",
    href: "/shop",
    children: [
      { label: "All Products", href: "/shop" },
      { label: "Human Hair Wigs", href: "/shop?category=human-hair-wigs" },
      { label: "Frontal Wigs", href: "/shop?category=frontal-wigs" },
      { label: "Closure Wigs", href: "/shop?category=closure-wigs" },
      { label: "Hair Bundles", href: "/shop?category=hair-bundles" },
      { label: "Raw Virgin Hair", href: "/shop?category=raw-virgin-hair" },
      { label: "Hair Accessories", href: "/shop?category=hair-accessories" },
      { label: "Custom Wigs", href: "/shop?category=custom-wigs" },
    ],
  },
  { label: "Collections", href: "/shop?sort=featured" },
  { label: "Booking", href: "/booking" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
] as const;

const CURRENCIES_LIST = Object.values(CURRENCIES);

export function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const cartCount = useCartItemCount();
  const wishlistCount = useWishlistStore((s) => s.productIds.size);
  const { currency, setCurrency } = useCurrencyStore();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
        setIsCurrencyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isHomePage = pathname === "/";
  const transparent = isHomePage && !isScrolled && !isMobileMenuOpen;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          transparent
            ? "bg-transparent"
            : "bg-surface-primary/95 backdrop-blur-md border-b border-border-subtle shadow-elevation-1"
        )}
      >
        {/* Promo Banner */}
        <div className="bg-gradient-gold py-2 px-4 text-center">
          <p className="text-brand-black text-xs font-semibold tracking-wide">
            Free shipping on orders over $150 · Ships to Nigeria, Ghana, UK, USA & Canada
          </p>
        </div>

        <div className="container-brand">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-3 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold rounded-lg"
            >
              <div className="relative w-8 h-8 lg:w-10 lg:h-10">
                <div className="absolute inset-0 bg-gradient-gold rounded-full opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display font-bold text-brand-gold text-lg lg:text-xl">RI</span>
                </div>
              </div>
              <div className="hidden sm:block">
                <span className="font-display font-medium text-text-primary text-lg leading-none block">
                  RI Hair
                </span>
                <span className="text-2xs font-semibold uppercase tracking-[0.2em] text-brand-gold leading-none">
                  Collectables
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav
              ref={dropdownRef}
              className="hidden lg:flex items-center gap-1"
              aria-label="Main navigation"
            >
              {NAV_LINKS.map((link) => (
                <div key={link.label} className="relative">
                  {link.children ? (
                    <button
                      className={cn(
                        "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200",
                        pathname.startsWith(link.href)
                          ? "text-brand-gold"
                          : "text-text-secondary hover:text-text-primary"
                      )}
                      onClick={() =>
                        setActiveDropdown(
                          activeDropdown === link.label ? null : link.label
                        )
                      }
                      aria-expanded={activeDropdown === link.label}
                      aria-haspopup="true"
                    >
                      {link.label}
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 transition-transform duration-200",
                          activeDropdown === link.label && "rotate-180"
                        )}
                      />
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200",
                        pathname === link.href
                          ? "text-brand-gold"
                          : "text-text-secondary hover:text-text-primary"
                      )}
                    >
                      {link.label}
                    </Link>
                  )}

                  <AnimatePresence>
                    {link.children && activeDropdown === link.label && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-2 w-56 bg-surface-elevated border border-border-subtle rounded-2xl shadow-elevation-3 overflow-hidden py-2"
                      >
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors duration-150"
                            onClick={() => setActiveDropdown(null)}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-1">
              {/* Currency Selector */}
              <div className="hidden md:block relative" ref={undefined}>
                <button
                  onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-full hover:bg-white/5"
                  aria-label="Change currency"
                  aria-expanded={isCurrencyOpen}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span className="font-semibold text-xs">{currency}</span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isCurrencyOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {isCurrencyOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 w-44 bg-surface-elevated border border-border-subtle rounded-2xl shadow-elevation-3 overflow-hidden py-2"
                    >
                      {CURRENCIES_LIST.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => {
                            setCurrency(c.code as SupportedCurrency);
                            setIsCurrencyOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors duration-150",
                            c.code === currency
                              ? "text-brand-gold bg-brand-gold/10"
                              : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                          )}
                        >
                          <span>{c.symbol} {c.name}</span>
                          <span className="text-xs text-text-muted">{c.code}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setIsSearchOpen(true)}
                className="btn-icon"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>

              <Link href="/account/wishlist" className="btn-icon relative hidden sm:flex" aria-label="Wishlist">
                <Heart className="w-4 h-4" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-gold text-brand-black text-2xs font-bold rounded-full flex items-center justify-center">
                    {wishlistCount > 9 ? "9+" : wishlistCount}
                  </span>
                )}
              </Link>

              <Link
                href={session ? "/account" : "/auth/login"}
                className="btn-icon hidden sm:flex"
                aria-label={session ? "My account" : "Sign in"}
              >
                <User className="w-4 h-4" />
              </Link>

              <button
                onClick={() => setIsCartOpen(true)}
                className="btn-icon relative"
                aria-label={`Cart, ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
              >
                <ShoppingBag className="w-4 h-4" />
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-brand-gold text-brand-black text-2xs font-bold rounded-full flex items-center justify-center"
                  >
                    {cartCount > 9 ? "9+" : cartCount}
                  </motion.span>
                )}
              </button>

              <button
                className="btn-icon lg:hidden ml-1"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="w-4 h-4" />
                ) : (
                  <Menu className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="lg:hidden border-t border-border-subtle bg-surface-primary overflow-hidden"
            >
              <div className="container-brand py-6 space-y-4">
                {NAV_LINKS.map((link) => (
                  <div key={link.label}>
                    <Link
                      href={link.href}
                      className={cn(
                        "block py-2.5 text-base font-medium border-b border-border-subtle",
                        pathname === link.href
                          ? "text-brand-gold"
                          : "text-text-primary"
                      )}
                    >
                      {link.label}
                    </Link>
                    {link.children && (
                      <div className="pl-4 pt-2 space-y-2">
                        {link.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block py-1.5 text-sm text-text-secondary hover:text-brand-gold transition-colors"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-4 border-t border-border-subtle flex items-center gap-4">
                  <Link
                    href={session ? "/account" : "/auth/login"}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <User className="w-4 h-4" />
                    {session ? "My Account" : "Sign In"}
                  </Link>
                  <Link
                    href="/account/wishlist"
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <Heart className="w-4 h-4" />
                    Wishlist
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
