import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { SetupRequired } from "@/components/setup-required";
import { SidebarNav } from "@/components/sidebar-nav";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export default async function DocumentsLayout({ children }: LayoutProps<"/documents">) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 md:py-5">
          <Link href="/documents" aria-label="Paperflow home">
            <Logo />
          </Link>
        </div>
        <div className="px-2 pb-2 md:flex-1">
          <Suspense fallback={null}>
            <SidebarNav />
          </Suspense>
        </div>
        <div className="hidden border-t border-slate-200 p-4 md:block">
          <p className="truncate text-xs text-slate-500" title={user.email}>
            Signed in as
            <br />
            <span className="font-medium text-slate-700">{user.email}</span>
          </p>
          <form action={signOut} className="mt-2">
            <button type="submit" className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {children}
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 md:hidden">
          <span className="font-medium text-slate-700">{user.email}</span> ·{" "}
          <form action={signOut} className="inline">
            <button type="submit" className="font-medium hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
