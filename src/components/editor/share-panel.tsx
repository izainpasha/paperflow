"use client";

import { useEffect, useState, type FormEvent } from "react";
import { fetchShares, revokeShare, shareDocument, updateSharePermission } from "@/app/actions/documents";
import type { DocumentShare, SharePermission } from "@/lib/types";

export function SharePanel({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [shares, setShares] = useState<DocumentShare[] | null>(null);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<SharePermission>("editor");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchShares(documentId).then((result) => {
      if (cancelled) return;
      if (result.ok) setShares(result.data);
      else {
        setShares([]);
        setFeedback({ kind: "error", text: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleShare(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    const result = await shareDocument(documentId, email, permission);
    setBusy(false);
    if (!result.ok) return setFeedback({ kind: "error", text: result.error });
    setShares(result.data.shares);
    setFeedback({ kind: "success", text: result.data.message });
    setEmail("");
  }

  async function handleChange(share: DocumentShare, next: SharePermission) {
    setFeedback(null);
    const result = await updateSharePermission(documentId, share.id, next);
    if (!result.ok) return setFeedback({ kind: "error", text: result.error });
    setShares(result.data);
  }

  async function handleRevoke(share: DocumentShare) {
    setFeedback(null);
    const result = await revokeShare(documentId, share.id);
    if (!result.ok) return setFeedback({ kind: "error", text: result.error });
    setShares(result.data);
    setFeedback({ kind: "success", text: `Removed access for ${share.email}.` });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center bg-slate-900/30 p-4 pt-[10vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="share-title" className="text-lg font-semibold text-slate-900">
            Share document
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Share with someone who already has a Paperflow account. Editors can change the title and content; viewers
          can only read.
        </p>

        <form onSubmit={handleShare} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="share-email" className="sr-only">
            Email address
          </label>
          <input
            id="share-email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
          <label htmlFor="share-permission" className="sr-only">
            Permission
          </label>
          <select
            id="share-permission"
            value={permission}
            onChange={(e) => setPermission(e.target.value as SharePermission)}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="editor">Can edit</option>
            <option value="viewer">Can view</option>
          </select>
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Sharing…" : "Share"}
          </button>
        </form>

        {feedback && (
          <p
            role={feedback.kind === "error" ? "alert" : "status"}
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              feedback.kind === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"
            }`}
          >
            {feedback.text}
          </p>
        )}

        <h3 className="mt-5 text-sm font-medium text-slate-700">People with access</h3>
        {shares === null ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : shares.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Only you can access this document.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {shares.map((share) => (
              <li key={share.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{share.email}</span>
                <select
                  aria-label={`Permission for ${share.email}`}
                  value={share.permission}
                  onChange={(e) => void handleChange(share, e.target.value as SharePermission)}
                  className="rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleRevoke(share)}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
