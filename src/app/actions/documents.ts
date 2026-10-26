"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listShares } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, DocumentShare, SharePermission } from "@/lib/types";
import {
  DEFAULT_TITLE,
  EMPTY_DOC,
  documentIdSchema,
  emailSchema,
  permissionSchema,
  titleSchema,
  validateDocumentContent,
} from "@/lib/validation";

const NOT_FOUND = "This document doesn't exist or you don't have access to it.";
const SIGNED_OUT = "Your session has expired. Please sign in again.";

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** Creates a document owned by the current user. owner_id is set by the database default (auth.uid()). */
export async function createDocument(input: { title?: string; content?: unknown } = {}): Promise<ActionResult<{ id: string }>> {
  if (!(await getCurrentUser())) return fail(SIGNED_OUT);

  const title = titleSchema.safeParse(input.title ?? DEFAULT_TITLE);
  if (!title.success) return fail(title.error.issues[0].message);
  const content = validateDocumentContent(input.content ?? EMPTY_DOC);
  if (!content.ok) return fail(content.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({ title: title.data, content: content.content })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createDocument failed", error);
    return fail("We couldn't create the document. Please try again.");
  }
  revalidatePath("/documents");
  return { ok: true, data: { id: data.id as string } };
}

/** Form action for the "New document" button. */
export async function createBlankDocument() {
  const result = await createDocument();
  if (!result.ok) redirect(`/documents?error=${encodeURIComponent(result.error)}`);
  redirect(`/documents/${result.data.id}`);
}

/** Saves title and/or content. RLS allows this only for the owner or an editor. */
export async function updateDocument(
  id: string,
  patch: { title?: string; content?: unknown },
): Promise<ActionResult<{ updatedAt: string }>> {
  if (!documentIdSchema.safeParse(id).success) return fail(NOT_FOUND);
  if (!(await getCurrentUser())) return fail(SIGNED_OUT);

  const update: { title?: string; content?: unknown } = {};
  if (patch.title !== undefined) {
    const title = titleSchema.safeParse(patch.title);
    if (!title.success) return fail(title.error.issues[0].message);
    update.title = title.data;
  }
  if (patch.content !== undefined) {
    const content = validateDocumentContent(patch.content);
    if (!content.ok) return fail(content.error);
    update.content = content.content;
  }
  if (Object.keys(update).length === 0) return fail("Nothing to save.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").update(update).eq("id", id).select("updated_at");

  if (error) {
    console.error("updateDocument failed", error);
    return fail("Saving failed. Check your connection and try again.");
  }
  // RLS filters out rows the user can't update, so zero rows means no access (or deleted).
  if (!data || data.length === 0) return fail("You don't have permission to edit this document, or it no longer exists.");
  return { ok: true, data: { updatedAt: data[0].updated_at as string } };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  if (!documentIdSchema.safeParse(id).success) return fail(NOT_FOUND);
  if (!(await getCurrentUser())) return fail(SIGNED_OUT);

  const supabase = await createClient();
  const { data, error } = await supabase.from("documents").delete().eq("id", id).select("id");
  if (error) {
    console.error("deleteDocument failed", error);
    return fail("We couldn't delete the document. Please try again.");
  }
  if (!data || data.length === 0) return fail("Only the owner can delete this document.");
  revalidatePath("/documents");
  return { ok: true, data: undefined };
}

const SHARE_MESSAGES: Record<string, { ok: boolean; message: string }> = {
  created: { ok: true, message: "Access granted." },
  updated: { ok: true, message: "This person already had access. Their permission was updated." },
  unchanged: { ok: true, message: "This person already has that access." },
  user_not_found: { ok: false, message: "No Paperflow account uses that email. Ask them to sign up first, then share again." },
  cannot_share_with_self: { ok: false, message: "You already own this document." },
  not_found: { ok: false, message: "Only the owner can share this document." },
  not_authenticated: { ok: false, message: SIGNED_OUT },
};

export async function fetchShares(documentId: string): Promise<ActionResult<DocumentShare[]>> {
  if (!documentIdSchema.safeParse(documentId).success) return fail(NOT_FOUND);
  if (!(await getCurrentUser())) return fail(SIGNED_OUT);
  try {
    return { ok: true, data: await listShares(documentId) };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "We couldn't load who has access.");
  }
}

/** Grants access by email via the share_document() database function, which verifies ownership. */
export async function shareDocument(
  documentId: string,
  email: string,
  permission: SharePermission,
): Promise<ActionResult<{ message: string; shares: DocumentShare[] }>> {
  if (!documentIdSchema.safeParse(documentId).success) return fail(NOT_FOUND);
  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) return fail(parsedEmail.error.issues[0].message);
  const parsedPermission = permissionSchema.safeParse(permission);
  if (!parsedPermission.success) return fail("Choose viewer or editor access.");
  const user = await getCurrentUser();
  if (!user) return fail(SIGNED_OUT);
  if (parsedEmail.data === user.email.toLowerCase()) return fail(SHARE_MESSAGES.cannot_share_with_self.message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_document", {
    p_document_id: documentId,
    p_email: parsedEmail.data,
    p_permission: parsedPermission.data,
  });
  if (error) {
    console.error("shareDocument failed", error);
    return fail("We couldn't share the document. Please try again.");
  }
  const outcome = SHARE_MESSAGES[String(data)] ?? { ok: false, message: "We couldn't share the document." };
  if (!outcome.ok) return fail(outcome.message);

  revalidatePath(`/documents/${documentId}`);
  return { ok: true, data: { message: outcome.message, shares: await listShares(documentId) } };
}

export async function updateSharePermission(
  documentId: string,
  shareId: string,
  permission: SharePermission,
): Promise<ActionResult<DocumentShare[]>> {
  if (!documentIdSchema.safeParse(documentId).success || !documentIdSchema.safeParse(shareId).success) return fail(NOT_FOUND);
  const parsedPermission = permissionSchema.safeParse(permission);
  if (!parsedPermission.success) return fail("Choose viewer or editor access.");
  if (!(await getCurrentUser())) return fail(SIGNED_OUT);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_shares")
    .update({ permission: parsedPermission.data })
    .eq("id", shareId)
    .eq("document_id", documentId)
    .select("id");
  if (error) {
    console.error("updateSharePermission failed", error);
    return fail("We couldn't change that permission.");
  }
  if (!data || data.length === 0) return fail("Only the owner can change access.");
  return { ok: true, data: await listShares(documentId) };
}

export async function revokeShare(documentId: string, shareId: string): Promise<ActionResult<DocumentShare[]>> {
  if (!documentIdSchema.safeParse(documentId).success || !documentIdSchema.safeParse(shareId).success) return fail(NOT_FOUND);
  if (!(await getCurrentUser())) return fail(SIGNED_OUT);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_shares")
    .delete()
    .eq("id", shareId)
    .eq("document_id", documentId)
    .select("id");
  if (error) {
    console.error("revokeShare failed", error);
    return fail("We couldn't remove access.");
  }
  if (!data || data.length === 0) return fail("Only the owner can remove access.");
  revalidatePath(`/documents/${documentId}`);
  return { ok: true, data: await listShares(documentId) };
}
