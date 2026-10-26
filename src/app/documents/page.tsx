import type { Metadata } from "next";
import Link from "next/link";
import { createBlankDocument } from "@/app/actions/documents";
import { ImportButton } from "@/components/import-button";
import { LocalTime } from "@/components/local-time";
import { RoleBadge } from "@/components/role-badge";
import { requireUser } from "@/lib/auth";
import { listDocuments } from "@/lib/documents";
import type { DocumentView } from "@/lib/types";

export const metadata: Metadata = { title: "Documents" };

const HEADINGS: Record<DocumentView, string> = {
  all: "All Documents",
  mine: "My Documents",
  shared: "Shared with Me",
};

const EMPTY: Record<DocumentView, { title: string; body: string }> = {
  all: { title: "No documents yet", body: "Create a new document or import a .txt or .md file to get started." },
  mine: { title: "You haven't created any documents", body: "Create a new document or import a .txt or .md file." },
  shared: {
    title: "Nothing shared with you yet",
    body: "When someone shares a document with your email address, it will appear here.",
  },
};

function parseView(value: unknown): DocumentView {
  return value === "mine" || value === "shared" ? value : "all";
}

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const params = await searchParams;
  const view = parseView(params.view);
  const q = typeof params.q === "string" ? params.q : "";
  const actionError = typeof params.error === "string" ? params.error : null;

  const user = await requireUser();
  const { documents, error } = await listDocuments(user, view, q);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{HEADINGS[view]}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Import supports <strong>.txt</strong> and <strong>.md</strong> files up to 1 MB.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ImportButton />
          <form action={createBlankDocument}>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + New document
            </button>
          </form>
        </div>
      </div>

      <form role="search" className="mt-6" action="/documents">
        {view !== "all" && <input type="hidden" name="view" value={view} />}
        <label htmlFor="q" className="sr-only">
          Search documents by title
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by title…"
          maxLength={100}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
        />
      </form>

      {(actionError || error) && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError ?? error}
        </p>
      )}

      {!error && documents.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          {q ? (
            <>
              <p className="font-medium text-slate-900">No documents match “{q}”</p>
              <Link
                href={view === "all" ? "/documents" : `/documents?view=${view}`}
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                Clear search
              </Link>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-900">{EMPTY[view].title}</p>
              <p className="mt-1 text-sm text-slate-500">{EMPTY[view].body}</p>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {documents.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/documents/${doc.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{doc.title}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <RoleBadge role={doc.role} />
                  {doc.role !== "owner" && doc.ownerEmail && <span>by {doc.ownerEmail}</span>}
                  <span>
                    Edited <LocalTime iso={doc.updatedAt} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
