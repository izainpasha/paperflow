"use client";

export default function DocumentsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-600">{error.message || "An unexpected error occurred."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </main>
  );
}
