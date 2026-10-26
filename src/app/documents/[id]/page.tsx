import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/editor/document-editor";
import { requireUser } from "@/lib/auth";
import { getDocument } from "@/lib/documents";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const doc = await getDocument(user, id);
  if (!doc) notFound();

  // key: remount the editor when switching documents so no state leaks between them.
  return <DocumentEditor key={doc.id} doc={doc} />;
}
