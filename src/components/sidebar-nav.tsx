"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { DocumentView } from "@/lib/types";

const ITEMS: { view: DocumentView; label: string; icon: string }[] = [
  { view: "all", label: "All Documents", icon: "▤" },
  { view: "mine", label: "My Documents", icon: "◉" },
  { view: "shared", label: "Shared with Me", icon: "⇄" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = pathname === "/documents" ? (searchParams.get("view") ?? "all") : null;

  return (
    <nav aria-label="Document views" className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map((item) => {
        const active = current === item.view;
        return (
          <Link
            key={item.view}
            href={item.view === "all" ? "/documents" : `/documents?view=${item.view}`}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span aria-hidden className="w-4 text-center">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
