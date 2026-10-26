import "server-only";
import type { JSONContent } from "@tiptap/core";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth";
import type { AccessRole, DocumentDetail, DocumentShare, DocumentSummary, DocumentView, SharePermission } from "@/lib/types";
import { documentIdSchema } from "@/lib/validation";

type OwnerJoin = { email: string } | { email: string }[] | null;

function ownerEmail(owner: OwnerJoin): string | null {
  if (!owner) return null;
  return Array.isArray(owner) ? (owner[0]?.email ?? null) : owner.email;
}

/** Escapes LIKE wildcards so user search text is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Lists documents visible to the user. RLS restricts rows to owned + shared; the view only narrows further. */
export async function listDocuments(
  user: CurrentUser,
  view: DocumentView,
  search: string,
): Promise<{ documents: DocumentSummary[]; error: string | null }> {
  const supabase = await createClient();

  let query = supabase
    .from("documents")
    .select("id, title, updated_at, owner_id, owner:profiles!documents_owner_id_fkey(email)")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (view === "mine") query = query.eq("owner_id", user.id);
  if (view === "shared") query = query.neq("owner_id", user.id);
  const term = search.trim().slice(0, 100);
  if (term) query = query.ilike("title", `%${escapeLike(term)}%`);

  const [docs, shares] = await Promise.all([
    query,
    supabase.from("document_shares").select("document_id, permission").eq("shared_with_user_id", user.id),
  ]);

  if (docs.error || shares.error) {
    console.error("listDocuments failed", docs.error ?? shares.error);
    return { documents: [], error: "We couldn't load your documents. Please try again." };
  }

  const permissionByDoc = new Map<string, SharePermission>(
    (shares.data ?? []).map((s) => [s.document_id as string, s.permission as SharePermission]),
  );

  return {
    error: null,
    documents: (docs.data ?? []).map((d) => ({
      id: d.id as string,
      title: d.title as string,
      updatedAt: d.updated_at as string,
      ownerEmail: ownerEmail(d.owner as OwnerJoin),
      role: d.owner_id === user.id ? "owner" : (permissionByDoc.get(d.id as string) ?? "viewer"),
    })),
  };
}

/** Loads one document, or null if it doesn't exist OR the user has no access (indistinguishable by design). */
export async function getDocument(user: CurrentUser, id: string): Promise<DocumentDetail | null> {
  if (!documentIdSchema.safeParse(id).success) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, content, updated_at, owner_id, owner:profiles!documents_owner_id_fkey(email)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getDocument failed", error);
    throw new Error("We couldn't load this document. Please try again.");
  }
  if (!data) return null;

  let role: AccessRole = "owner";
  if (data.owner_id !== user.id) {
    const { data: share } = await supabase
      .from("document_shares")
      .select("permission")
      .eq("document_id", id)
      .eq("shared_with_user_id", user.id)
      .maybeSingle();
    role = (share?.permission as SharePermission | undefined) ?? "viewer";
  }

  return {
    id: data.id as string,
    title: data.title as string,
    content: data.content as JSONContent,
    updatedAt: data.updated_at as string,
    ownerEmail: ownerEmail(data.owner as OwnerJoin),
    role,
  };
}

/** Shares for a document. RLS returns rows only to the owner (or the recipient's own row). */
export async function listShares(documentId: string): Promise<DocumentShare[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_shares")
    .select("id, permission, created_at, user:profiles!document_shares_shared_with_user_id_fkey(email)")
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("listShares failed", error);
    throw new Error("We couldn't load who has access.");
  }
  return (data ?? []).map((s) => ({
    id: s.id as string,
    email: ownerEmail(s.user as OwnerJoin) ?? "Unknown user",
    permission: s.permission as SharePermission,
  }));
}
