"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/sidebar-nav";

/**
 * Desktop: fixed left sidebar. Mobile: compact top bar with a 3-way segmented control,
 * hidden inside a document (the editor has its own back button) to give the page room.
 */
export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const inDocument = pathname.startsWith("/documents/");

  return (
    <aside
      className={`${inDocument ? "hidden md:flex" : "flex"} flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0`}
    >
      <div className="flex items-center justify-between px-4 py-3 md:py-5">
        <Link href="/documents" aria-label="Paperflow home">
          <Logo />
        </Link>
        <form action={signOut} className="md:hidden">
          <button type="submit" className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline">
            Sign out
          </button>
        </form>
      </div>
      <div className="px-3 pb-3 md:flex-1 md:px-2 md:pb-2">
        <Suspense fallback={null}>
          <SidebarNav />
        </Suspense>
      </div>
      <div className="hidden border-t border-slate-200 p-4 md:block">
        <p className="truncate text-xs text-slate-500" title={email}>
          Signed in as
          <br />
          <span className="font-medium text-slate-700">{email}</span>
        </p>
        <form action={signOut} className="mt-2">
          <button type="submit" className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
