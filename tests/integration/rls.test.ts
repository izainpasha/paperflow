/**
 * Live Row Level Security checks against a real Supabase project, using two
 * confirmed test accounts and only the public (publishable/anon) key — exactly
 * what a malicious browser client would have. Skipped unless env vars are set:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 *   TEST_USER_A_EMAIL/PASSWORD, TEST_USER_B_EMAIL/PASSWORD
 * Run: npm run test:integration
 *
 * @vitest-environment node
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a = { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD };
const b = { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD };
const configured = Boolean(url && key && a.email && a.password && b.email && b.password);

async function signedInClient(email: string, password: string) {
  const client = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return { client, userId: data.user.id };
}

describe.skipIf(!configured)("RLS: document access is enforced by the database", () => {
  let alice: SupabaseClient;
  let bob: SupabaseClient;
  let anon: SupabaseClient;
  let aliceId: string;
  let bobId: string;
  let docId: string;

  beforeAll(async () => {
    ({ client: alice, userId: aliceId } = await signedInClient(a.email!, a.password!));
    ({ client: bob, userId: bobId } = await signedInClient(b.email!, b.password!));
    anon = createClient(url!, key!, { auth: { persistSession: false } });

    const { data, error } = await alice
      .from("documents")
      .insert({ title: "RLS test (private)", content: { type: "doc", content: [{ type: "paragraph" }] } })
      .select("id, owner_id")
      .single();
    if (error) throw error;
    docId = data.id;
    expect(data.owner_id).toBe(aliceId);
  });

  afterAll(async () => {
    if (docId) await alice.from("documents").delete().eq("id", docId);
  });

  it("anonymous users cannot read documents", async () => {
    const { data } = await anon.from("documents").select("id").eq("id", docId);
    expect(data ?? []).toHaveLength(0);
  });

  it("a non-shared user cannot read, update, delete or share the document by guessing its id", async () => {
    const read = await bob.from("documents").select("id").eq("id", docId);
    expect(read.data).toEqual([]);

    const update = await bob.from("documents").update({ title: "hacked" }).eq("id", docId).select("id");
    expect(update.data ?? []).toEqual([]);

    const del = await bob.from("documents").delete().eq("id", docId).select("id");
    expect(del.data ?? []).toEqual([]);

    const share = await bob.rpc("share_document", { p_document_id: docId, p_email: b.email, p_permission: "editor" });
    expect(share.data).toBe("not_found");

    const directShare = await bob.from("document_shares").insert({ document_id: docId, shared_with_user_id: bobId });
    expect(directShare.error).not.toBeNull();

    const check = await alice.from("documents").select("title").eq("id", docId).single();
    expect(check.data?.title).toBe("RLS test (private)");
  });

  it("users cannot create documents on someone else's behalf", async () => {
    const { error } = await bob.from("documents").insert({ owner_id: aliceId, title: "spoofed" });
    expect(error).not.toBeNull();
  });

  it("a viewer can read but not modify; an editor can modify but not re-share or delete", async () => {
    expect((await alice.rpc("share_document", { p_document_id: docId, p_email: b.email, p_permission: "viewer" })).data).toBe("created");
    expect((await alice.rpc("share_document", { p_document_id: docId, p_email: b.email, p_permission: "viewer" })).data).toBe("unchanged");

    const read = await bob.from("documents").select("title").eq("id", docId).single();
    expect(read.data?.title).toBe("RLS test (private)");
    const viewerUpdate = await bob.from("documents").update({ title: "viewer edit" }).eq("id", docId).select("id");
    expect(viewerUpdate.data ?? []).toEqual([]);

    expect((await alice.rpc("share_document", { p_document_id: docId, p_email: b.email, p_permission: "editor" })).data).toBe("updated");
    const editorUpdate = await bob.from("documents").update({ title: "editor edit" }).eq("id", docId).select("title");
    expect(editorUpdate.data).toEqual([{ title: "editor edit" }]);

    const ownerChange = await bob.from("documents").update({ owner_id: bobId } as never).eq("id", docId);
    expect(ownerChange.error).not.toBeNull();

    const reshare = await bob.rpc("share_document", { p_document_id: docId, p_email: a.email, p_permission: "editor" });
    expect(reshare.data).toBe("not_found");
    const del = await bob.from("documents").delete().eq("id", docId).select("id");
    expect(del.data ?? []).toEqual([]);
  });

  it("revoking access removes it immediately", async () => {
    const { data: shares } = await alice.from("document_shares").select("id").eq("document_id", docId);
    expect(shares).toHaveLength(1);
    await alice.from("document_shares").delete().eq("id", shares![0].id);

    const read = await bob.from("documents").select("id").eq("id", docId);
    expect(read.data).toEqual([]);
  });

  it("sharing reports unknown users and self-shares", async () => {
    const unknown = await alice.rpc("share_document", {
      p_document_id: docId,
      p_email: `nobody-${Date.now()}@example.com`,
      p_permission: "viewer",
    });
    expect(unknown.data).toBe("user_not_found");
    const self = await alice.rpc("share_document", { p_document_id: docId, p_email: a.email, p_permission: "viewer" });
    expect(self.data).toBe("cannot_share_with_self");
  });

  it("profiles are visible only to yourself and people you share documents with", async () => {
    // Expected set derived from Bob's own sharing relationships (other data in the
    // project, e.g. a demo doc Alice shared with Bob, legitimately widens it).
    const [{ data: visibleDocs }, { data: visibleShares }, { data: profiles }] = await Promise.all([
      bob.from("documents").select("owner_id"),
      bob.from("document_shares").select("shared_with_user_id"),
      bob.from("profiles").select("id"),
    ]);
    const expected = new Set<string>([bobId]);
    for (const d of visibleDocs ?? []) expected.add(d.owner_id);
    for (const s of visibleShares ?? []) expected.add(s.shared_with_user_id);

    const seen = new Set((profiles ?? []).map((p) => p.id));
    expect(seen).toEqual(expected);
    // Anonymous callers see no profiles at all.
    const anonProfiles = await anon.from("profiles").select("id");
    expect(anonProfiles.data ?? []).toEqual([]);
  });
});
