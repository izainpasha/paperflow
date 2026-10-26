export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading document">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="h-6 w-64 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mx-auto mt-10 max-w-3xl space-y-3 rounded-xl border border-slate-200 bg-white p-12">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
