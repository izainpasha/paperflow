"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createDocument } from "@/app/actions/documents";
import { fileTextToDoc, isDocEmpty } from "@/lib/editor/import";
import { titleFromFileName, validateImportFile } from "@/lib/validation";

type Props = {
  /** Injected for tests; defaults to the server action. */
  create?: typeof createDocument;
};

export function ImportButton({ create = createDocument }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    const check = validateImportFile(file);
    if (!check.ok) return setError(check.error);

    setBusy(true);
    try {
      const text = await file.text();
      if (!text.trim()) return setError("That file is empty.");
      const content = fileTextToDoc(text, check.kind);
      if (isDocEmpty(content)) return setError("We couldn't find any text to import in that file.");

      const result = await create({ title: titleFromFileName(file.name), content });
      if (!result.ok) return setError(result.error);
      router.push(`/documents/${result.data.id}`);
    } catch {
      setError("We couldn't read that file. Make sure it is a UTF-8 text or Markdown file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start">
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        className="sr-only"
        id="import-file"
        data-testid="import-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? "Importing…" : "Import .txt / .md"}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
