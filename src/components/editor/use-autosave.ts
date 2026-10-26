"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";
export type SaveResult = { ok: true } | { ok: false; error: string };

/**
 * Debounced autosave. Patches are merged while waiting, only one save runs at a time,
 * and edits made during an in-flight save are saved right after it finishes.
 * Failed patches are kept so `flush()` (retry) re-sends them.
 */
export function useAutosave<TPatch extends object>(save: (patch: TPatch) => Promise<SaveResult>, delayMs = 800) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<TPatch | null>(null);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (saving.current) return;

    saving.current = true;
    // Keep saving until nothing is pending (edits may arrive during a save).
    while (pending.current) {
      const patch = pending.current;
      pending.current = null;
      setStatus("saving");

      let result: SaveResult;
      try {
        result = await saveRef.current(patch);
      } catch {
        result = { ok: false, error: "Saving failed. Check your connection and try again." };
      }

      if (!result.ok) {
        // Keep the failed changes underneath any newer edits so a retry sends everything.
        pending.current = { ...patch, ...(pending.current ?? {}) } as TPatch;
        saving.current = false;
        setError(result.error);
        setStatus("error");
        return;
      }
      setError(null);
    }
    saving.current = false;
    setStatus("saved");
  }, []);

  const schedule = useCallback(
    (patch: TPatch) => {
      pending.current = { ...(pending.current ?? {}), ...patch } as TPatch;
      setStatus((s) => (s === "saving" ? s : "unsaved"));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [delayMs, flush],
  );

  // Warn before closing the tab with unsaved work, and save when the tab is hidden.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current || saving.current) e.preventDefault();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      // Leaving the page via in-app navigation: send whatever is still pending.
      void flush();
    };
  }, [flush]);

  return { status, error, schedule, flush };
}
