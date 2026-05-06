"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Calendar,
  Tag,
  BarChart2,
  Settings,
  FileText,
  Star,
  Truck,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/bookings", label: "Bookings", icon: Calendar },
  { href: "/admin/inventory", label: "Inventory", icon: Truck },
  { href: "/admin/returns", label: "Returns", icon: RotateCcw },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/content", label: "Content", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-60 bg-surface-secondary border-r border-border-subtle flex flex-col min-h-screen flex-shrink-0 sticky top-0">
      <div className="px-5 py-5 border-b border-border-subtle">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-gold rounded-lg flex items-center justify-center">
            <span className="font-display font-bold text-brand-black text-sm">RI</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-primary leading-none">Admin</p>
            <p className="text-2xs text-text-muted">RI Hair Collectables</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150",
              isActive(href, exact)
                ? "bg-brand-gold/10 text-brand-gold"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-border-subtle">
        <Link
          href="/"
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          ← Back to Store
        </Link>
      </div>
    </aside>
  );
}
