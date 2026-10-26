export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold text-slate-900 ${className}`}>
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-blue-600 text-sm font-bold text-white">
        P
      </span>
      Paperflow
    </span>
  );
}
