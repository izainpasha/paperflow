export function SetupRequired() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-900">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-amber-900">
          Paperflow needs a Supabase project for sign-in and storage. Set{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (see <code>.env.example</code> and
          the README), apply <code className="font-mono">supabase/migrations</code>, then restart the app.
        </p>
      </div>
    </main>
  );
}
