"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { deleteDocument, updateDocument } from "@/app/actions/documents";
import { RoleBadge } from "@/components/role-badge";
import { editorExtensions } from "@/lib/editor/extensions";
import type { DocumentDetail } from "@/lib/types";
import { DEFAULT_TITLE, TITLE_MAX_LENGTH } from "@/lib/validation";
import { SharePanel } from "./share-panel";
import { Toolbar } from "./toolbar";
import { useAutosave, type SaveStatus } from "./use-autosave";

type Patch = { title?: string; content?: JSONContent };

const STATUS_TEXT: Record<SaveStatus, string> = {
  saved: "All changes saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Not saved",
};

export function DocumentEditor({ doc }: { doc: DocumentDetail }) {
  const router = useRouter();
  const canEdit = doc.role !== "viewer";
  const isOwner = doc.role === "owner";
  const [title, setTitle] = useState(doc.title);
  const [shareOpen, setShareOpen] = useState(false);

  const save = useCallback(
    async (patch: Patch) => {
      const result = await updateDocument(doc.id, patch);
      return result.ok ? { ok: true as const } : result;
    },
    [doc.id],
  );
  const autosave = useAutosave<Patch>(save);
  const { schedule, flush } = autosave;

  const editor = useEditor({
    extensions: editorExtensions,
    content: doc.content,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-doc",
        "aria-label": "Document content",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => schedule({ content: e.getJSON() }),
  });

  // Ctrl/Cmd+S saves immediately instead of opening the browser's save dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (value.trim()) schedule({ title: value });
  };

  const onTitleBlur = () => {
    if (!title.trim()) {
      setTitle(DEFAULT_TITLE);
      schedule({ title: DEFAULT_TITLE });
    }
  };

  async function onDelete() {
    if (!window.confirm(`Delete “${title}”? This can't be undone.`)) return;
    const result = await deleteDocument(doc.id);
    if (!result.ok) return window.alert(result.error);
    router.push("/documents");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 md:px-6">
          <Link href="/documents" className="text-sm text-slate-500 hover:text-slate-900" aria-label="Back to documents">
            ← Documents
          </Link>
          <div className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1">
            <label htmlFor="doc-title" className="sr-only">
              Document title
            </label>
            <input
              id="doc-title"
              value={title}
              readOnly={!canEdit}
              maxLength={TITLE_MAX_LENGTH}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleBlur}
              className="w-full truncate rounded-md border border-transparent px-2 py-1 text-lg font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-500 focus:outline-none read-only:hover:border-transparent"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {canEdit && (
              <span
                role="status"
                aria-live="polite"
                className={`text-xs whitespace-nowrap ${
                  autosave.status === "error" ? "text-red-600" : "text-slate-500"
                }`}
              >
                {STATUS_TEXT[autosave.status]}
              </span>
            )}
            <RoleBadge role={doc.role} />
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  className="rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-red-50 hover:text-red-700"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        {autosave.status === "error" && (
          <div role="alert" className="flex items-center gap-3 bg-red-50 px-4 py-2 text-sm text-red-700 md:px-6">
            <span>{autosave.error}</span>
            <button type="button" onClick={() => void flush()} className="font-semibold underline">
              Retry
            </button>
          </div>
        )}
        {!canEdit && (
          <div className="bg-amber-50 px-4 py-2 text-sm text-amber-900 md:px-6">
            You have view-only access{doc.ownerEmail ? ` to ${doc.ownerEmail}'s document` : ""}.
          </div>
        )}
        {canEdit && editor && <Toolbar editor={editor} />}
      </header>

      <main className="flex-1 px-4 py-6 md:px-6 md:py-10">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white px-6 py-8 shadow-sm md:px-12 md:py-12">
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div aria-busy="true" className="space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            </div>
          )}
        </div>
        {!isOwner && doc.ownerEmail && (
          <p className="mx-auto mt-3 max-w-3xl text-xs text-slate-500">Owned by {doc.ownerEmail}</p>
        )}
      </main>

      {shareOpen && <SharePanel documentId={doc.id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
