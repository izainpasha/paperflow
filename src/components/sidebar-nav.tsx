"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { DocumentView } from "@/lib/types";

const ITEMS: { view: DocumentView; label: string; short: string; icon: string }[] = [
  { view: "all", label: "All Documents", short: "All", icon: "▤" },
  { view: "mine", label: "My Documents", short: "Mine", icon: "◉" },
  { view: "shared", label: "Shared with Me", short: "Shared", icon: "⇄" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = pathname === "/documents" ? (searchParams.get("view") ?? "all") : null;

  return (
    // Mobile: equal-width segmented control. Desktop: vertical list.
    <nav
      aria-label="Document views"
      className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 md:flex md:flex-col md:bg-transparent md:p-0"
    >
      {ITEMS.map((item) => {
        const active = current === item.view;
        return (
          <Link
            key={item.view}
            href={item.view === "all" ? "/documents" : `/documents?view=${item.view}`}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors md:justify-start md:rounded-lg md:px-3 md:py-2 ${
              active
                ? "bg-white text-blue-700 shadow-sm md:bg-blue-50 md:shadow-none"
                : "text-slate-600 hover:text-slate-900 md:hover:bg-slate-100"
            }`}
          >
            <span aria-hidden className="hidden w-4 text-center md:inline">
              {item.icon}
            </span>
            <span className="md:hidden">{item.short}</span>
            <span className="hidden md:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
