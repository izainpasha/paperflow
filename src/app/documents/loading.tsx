export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 h-9 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-6 space-y-px overflow-hidden rounded-xl border border-slate-200 bg-white">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
