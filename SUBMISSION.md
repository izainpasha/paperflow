# Paperflow: Submission

Ajaia Full Stack Product Engineer assessment: a lightweight collaborative document editor.

| | |
|---|---|
| **Google Drive folder** | **[PASTE YOUR GOOGLE DRIVE LINK HERE]** |
| **Live application** | https://paperflow-five-psi.vercel.app |
| **GitHub repository** | https://github.com/izainpasha/paperflow |
| **Walkthrough video** | ⚠️ **PENDING**: not yet recorded. See [VIDEO_URL.txt](VIDEO_URL.txt) |

## Demo accounts

Demo-only accounts on reserved `.test` addresses (no real inboxes). Both were verified by signing in on the live app.

| Role in the demo | Email | Password |
|---|---|---|
| Owner | `alice@paperflow.test` | `Paperflow-Demo-2026` |
| Recipient | `bob@paperflow.test` | `Paperflow-Demo-2026` |

Alice owns **"Welcome to Paperflow"**, which is shared with Bob as a viewer.

You can also **create your own account** on the sign-in page. Email confirmation is disabled, so you are signed in immediately (verified on the live app, 2026-10-27).

**Suggested 3-minute check**
1. Sign in as Alice → **+ New document** → set a title and format text (heading, font, size, bold/underline, lists, alignment, indent) → wait for *All changes saved* → reload; everything persists.
2. Dashboard → **Import .txt / .md** with any Markdown file → a new formatted document opens.
3. In a document → **Share** → `bob@paperflow.test` → *Can view* (an unknown email shows a clear error).
4. Private window as Bob → **Shared with Me** → open it: read-only, no toolbar. Paste the URL of one of Alice's *unshared* documents → *Document not available*.
5. As Alice, switch Bob to *Can edit* (the row shows *Saving…* → *✓ Saved*). Bob can now edit, and Alice sees the change after a reload.

## Implemented features

| Requirement | Implementation |
|---|---|
| Create, rename, edit, save, reopen | Autosave with visible status (*Unsaved changes* → *Saving…* → *All changes saved*), Retry on failure, unsaved-changes warning, `Ctrl/Cmd+S` |
| Rich-text formatting | Headings H1–H3, font family, font size, bold, italic, underline, strikethrough, alignment, bulleted/numbered lists, indent/outdent, quotes, clear formatting, undo/redo. Stored as Tiptap JSON, so it persists across reloads |
| File import | **`.txt` and `.md` only**, ≤ 1 MB, with clear errors for unsupported, empty, or oversized files. `.docx` is **not** supported |
| Sharing | Owner shares by email with existing users as **viewer** or **editor**; can change or revoke access |
| Owned vs. shared | Sidebar views *All / My Documents / Shared with Me*, access badges, owner email on shared docs |
| Server-side enforcement | Supabase Row Level Security, column-level grants, and a `SECURITY DEFINER` share function. No service-role key in the app |
| Auth and persistence | Supabase Auth (email + password) and PostgreSQL |
| UX states | Empty, loading, error, and success states; responsive down to 390 px wide |

## Verification (re-run 2026-10-27, final audit)

| Check | Result |
|---|---|
| `npm run lint` | ✅ 0 problems |
| `npm run typecheck` (TypeScript strict) | ✅ 0 errors |
| `npm test`: unit + component tests | ✅ **41 passed** in 7 files (validation 13, import 11, formatting 4, toolbar 4, import button 4, autosave 3, share dialog 2) |
| `npm run test:integration`: live RLS tests against the production Supabase project, signed in as two real users with only the public key | ✅ **7/7 passed** |
| `npm run build` | ✅ passes |
| Browser end-to-end run against the **deployed** app (sign-in, create, format, reload persistence, import, share, viewer read-only, unshared-doc denial, editor upgrade, 390 px layout) | ✅ **26/26 checks** |
| Database audit | ✅ RLS on all tables; anonymous role has no table access or function execute; signed-in users cannot change `owner_id`, retarget shares, or insert shares directly |
| Self sign-up on the live app | ✅ New account is signed in immediately (email confirmation disabled; checked via the Supabase auth settings endpoint) |
| Secrets audit | ✅ No `.env` files or keys in git history; Vercel holds only the two public `NEXT_PUBLIC_SUPABASE_*` variables |

*Test count history:* earlier drafts of these docs said 29, then 39. Those were accurate when written; tests were added for the formatting toolbar, the import fix, and share-dialog feedback. **41** is the current verified count.

The browser E2E script was run manually (playwright-core with Edge) and is not committed as a CI test.

## Known limitations

- **No real-time co-editing.** Saves are last-write-wins; simultaneous editors can overwrite each other, and others' changes appear after a reload.
- **Sharing only with existing accounts.** No invitation emails. The "no account uses that email" message reveals whether an email is registered (accepted trade-off).
- **Search covers titles only**, not document content.
- **Import:** client-side conversion of `.txt`/`.md` only. Markdown images, raw HTML, and relative links are dropped or turned into plain text.
- **Not included:** ownership transfer, folders, version history, comments.
- **Supabase free tier:** the project pauses after about a week of inactivity. Email confirmation is disabled for this demo, so sign-up does not verify email ownership.

## Next steps (another 2–4 hours)

1. Real-time collaboration (Yjs + Tiptap Collaboration over Supabase Realtime) with presence.
2. An optimistic-concurrency check on save (`updated_at` precondition) as an interim conflict guard.
3. Commit the browser E2E suite and run it plus the RLS suite in CI against a Supabase branch database.
4. Invitations for non-users, plus rate limiting on share lookups.
5. Full-text content search; `.docx` import with the same sanitisation.

See [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [AI_WORKFLOW.md](AI_WORKFLOW.md) for details.
