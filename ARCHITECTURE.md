# Architecture

Paperflow is a single Next.js 16 (App Router) application backed by Supabase (Auth + PostgreSQL). There is no separate API server: Server Components read data, Server Actions write it, and **PostgreSQL Row Level Security is the authorization boundary**.

```
Browser ──(cookie session)──▶ Next.js on Vercel ──(user's JWT, publishable key)──▶ Supabase
  Tiptap editor                proxy.ts: refresh session, route guard            Auth (email + password)
  Server Action calls          Server Components: list / load documents          Postgres + RLS policies
                               Server Actions: validate (zod + allow-list),       share_document() RPC
                                               then insert/update/delete
```

## Request flow

| Concern | Where | Notes |
|---|---|---|
| Session refresh + coarse redirects | `src/proxy.ts` → `src/lib/supabase/proxy.ts` | Next 16 renamed `middleware` to `proxy`. Uses `getClaims()` (verifies the JWT). Redirects are UX only, not security. |
| Current user | `src/lib/auth.ts` | `getClaims()` server-side. User id is **never** accepted from the browser. |
| Reads | `src/lib/documents.ts` | Plain `select`s run as the user, so RLS returns only owned + shared rows. |
| Writes | `src/app/actions/*.ts` | Validate input, then run as the user; RLS decides. Zero affected rows ⇒ "no permission / not found". |
| Editor | `src/components/editor/*` | Tiptap 3 (StarterKit), debounced autosave hook, toolbar, share dialog. |
| Import | `src/lib/editor/import.ts`, `src/components/import-button.tsx` | Client-side conversion to Tiptap JSON, then the normal create action (server re-validates). |

## Data model

Schema: [`supabase/migrations/20261027000000_init.sql`](supabase/migrations/20261027000000_init.sql).

```
auth.users ──1:1── profiles(id, email)          (trigger-maintained mirror; email lowercased)
                      │
                      ├──< documents(id, owner_id → profiles, title, content jsonb, created_at, updated_at)
                      │        │
                      └──< document_shares(id, document_id → documents, shared_with_user_id → profiles,
                                            permission viewer|editor, created_at,
                                            UNIQUE(document_id, shared_with_user_id))
```

- `documents.title`: 1–200 chars after trimming (CHECK).
- `documents.content`: Tiptap JSON (`jsonb`), must be an object with `type = 'doc'`, ≤ ~1 MB (CHECK). The app enforces a tighter 500 KB limit plus a schema allow-list.
- `updated_at` is set by a trigger; `owner_id` and `created_at` are immutable (trigger).
- Indexes: `(owner_id, updated_at desc)`, `(updated_at desc)`, `document_shares(shared_with_user_id)`, plus the unique share key.
- `profiles` exists so sharing can resolve an email without exposing `auth.users`, and so owner/recipient emails can be shown.

## Security model

**RLS policies** (all `to authenticated`; `anon` has no table privileges at all):

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `documents` | owner, or has a share | `owner_id = auth.uid()` (column defaults to `auth.uid()`) | owner, or share with `editor` | owner |
| `document_shares` | recipient (own row) or document owner | **none** – only via `share_document()` | document owner (permission column only) | document owner |
| `profiles` | yourself, or someone you share a document with / who shares with you | – | – | – |

Additional hardening:
- **Column-level grants**: users can only insert/update `title` and `content` on `documents`, and only `permission` on `document_shares`. An editor cannot change `owner_id` even with a crafted request.
- **No ID probing**: a document that doesn't exist and one you can't see look identical (RLS returns no row → 404 page "Document not available"; `share_document` returns `not_found` for both).
- **`share_document(document_id, email, permission)`** is `SECURITY DEFINER` with an empty `search_path`. It checks that `auth.uid()` owns the document, resolves the email to an existing user, refuses self-shares, and upserts (`created` / `updated` / `unchanged`). A trigger also blocks sharing a document with its owner.
- RLS helper functions (`is_document_owner`, `document_share_permission`, `can_view_profile`) are `SECURITY DEFINER` to avoid recursive policy evaluation between `documents` and `document_shares`; each answers only about `auth.uid()`.
- **No service-role key** anywhere in the app. The browser only ever has the publishable key, so the live RLS test suite (`tests/integration/rls.test.ts`) attacks the database with exactly the access an attacker would have.
- **Content safety**: documents are stored as Tiptap JSON and rendered only through the Tiptap/ProseMirror schema, never via `dangerouslySetInnerHTML`. On save, the server validates an allow-list of node and mark types, `http/https/mailto`-only links, allow-listed font families/sizes/alignments/indent levels (so `style` attributes can't carry arbitrary CSS), max nesting depth, and size. The client normalises editor JSON to the same rules before sending (`normalizeContent`), so pasted styles never block autosave. Markdown import goes Markdown → HTML (marked) → `generateJSON` with the editor schema, which drops anything the schema doesn't define (scripts, images, raw HTML, event handlers).
- Basic security headers (`nosniff`, `X-Frame-Options: DENY`, referrer policy).

## Key decisions and trade-offs

- **Server Actions + RLS instead of a REST API.** Less code, and authorization lives in one place (the database), so a bug in a React component can't leak data. The cost is that error messages are inferred from "0 rows affected".
- **Autosave (800 ms debounce) with last-write-wins.** One save in flight at a time; edits made during a save are sent right after. Failed saves keep the pending patch and show a Retry banner. `beforeunload` warns about unsaved work, and changes are flushed when the tab is hidden or the editor unmounts. There is **no** real-time co-editing or conflict detection: two people editing at once will overwrite each other's saves.
- **Sharing is limited to existing accounts.** No invitation emails. The trade-off is that the "No Paperflow account uses that email" message lets an authenticated user learn whether an email is registered. That was accepted for usability; rate limiting would be the next mitigation.
- **`cacheComponents` disabled.** The scaffold enabled it, but every route is per-user and cookie-authenticated, so there is no shared static shell to cache, and caching would add a cross-user staleness risk.
- **Search covers titles only** (`ILIKE` with escaped wildcards). Full-text search over content would need a generated `tsvector` column.
- **Email + password auth.** It's the simplest flow that works for two-account testing. "Confirm email" is disabled in the live Supabase project so reviewers can sign up instantly (Supabase's default mailer only delivers to project team members); the trade-off is that email ownership isn't verified. If it is re-enabled, sign-up uses the PKCE email-confirmation flow handled by `/auth/callback`.

## Scope cuts

Real-time collaboration and presence, comments, version history, `.docx` import/export, invitation emails for non-users, ownership transfer, folders, and full-text content search are all out of scope. See SUBMISSION.md for next steps.
