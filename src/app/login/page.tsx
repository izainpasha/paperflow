import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/logo";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!isSupabaseConfigured()) return <SetupRequired />;
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo className="text-xl" />
          <p className="mt-3 text-sm text-slate-600">Write, import and share documents with your team.</p>
        </div>
        <AuthForm initialError={typeof error === "string" ? error : undefined} />
        <p className="mt-4 text-center text-xs text-slate-500">
          New here? Create an account with any email. To try sharing, create a second account in a private window.
        </p>
      </div>
    </main>
  );
}
