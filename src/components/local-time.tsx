"use client";

/** Renders a timestamp in the viewer's locale/timezone. */
export function LocalTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
    </time>
  );
}
