"use client";

import { Package, ReceiptText, SquareKanban } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/orders", label: "Pedidos", icon: ReceiptText },
  { href: "/kanban", label: "Kanban", icon: SquareKanban },
  { href: "/products", label: "Productos", icon: Package },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex items-center gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-mint text-ink" : "text-ink-muted hover:bg-brand-mint/40 hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
