# Submission: Paperflow

## Links

- **Live app:** https://paperflow-five-psi.vercel.app
- **Source:** https://github.com/izainpasha/paperflow
- **Walkthrough video:** see [VIDEO_URL.txt](VIDEO_URL.txt)

## Test accounts

These are demo-only accounts on reserved `.test` addresses. No real inboxes, no other data.

| Role in the demo | Email | Password |
|---|---|---|
| Owner | `alice@paperflow.test` | `Paperflow-Demo-2026` |
| Recipient | `bob@paperflow.test` | `Paperflow-Demo-2026` |

You can also create your own account on the sign-in page. Email confirmation is disabled, so you're signed in immediately.

**Suggested 3-minute check:**
1. Sign in as Alice → **+ New document** → type a title, use the toolbar (heading, bold, underline, lists) → wait for *All changes saved* → reload the page; formatting persists.
2. **Import .txt / .md** on the dashboard with any Markdown file → a new formatted document opens.
3. In a document, **Share** → `bob@paperflow.test` → *Can view* (try an unknown email to see the error).
4. In a private window, sign in as Bob → **Shared with Me** → open the document (read-only banner, no toolbar). Paste the URL of one of Alice's *unshared* documents → *Document not available*.
5. As Alice, switch Bob to *Can edit*; Bob can now edit and Alice sees the change after a reload.

## What's included

| Requirement | Status |
|---|---|
| Create, rename, edit, save, reopen documents | ✅ Autosave with status, retry on failure, unsaved-changes warning |
| Bold, italic, underline, headings (H1–H3), bulleted and numbered lists | ✅ Stored as Tiptap JSON; persists across reloads |
| Import `.txt` and `.md` into a new editable document | ✅ Type, size (1 MB), and empty-content validation with clear errors. **No `.docx`.** |
| Owner shares with another authenticated user by email | ✅ Viewer / editor permissions; change and revoke |
| Owned vs. shared clearly distinguished | ✅ Sidebar views (All / My / Shared with Me) + badges + owner email |
| Enforced on the server/database | ✅ Supabase RLS + column grants + `SECURITY DEFINER` share function; verified by live tests as a second user |
| Supabase Auth + Postgres persistence | ✅ Email/password; no service-role key in the app |
| Tests | ✅ 29 unit/component tests + 7 live RLS integration tests |
| Docs | ✅ README, ARCHITECTURE, AI_WORKFLOW, this file, screenshots in `docs/screenshots/` |
| Deployed | ✅ Vercel (production) |

## Verification performed

- `npm run lint`, `npm run typecheck`, `npm test` (29 passing), `npm run build`: all clean.
- `npm run test:integration`: **7/7** live RLS tests passing against the production Supabase project.
- Browser end-to-end run (25 checks) against the local production build: **25/25**.
- The same E2E run against the deployed URL: **26/26** (adds a check that the recipient sees upgraded editor access).

## Known limitations

- **No real-time collaboration.** Saves are last-write-wins; two people editing the same document at once can overwrite each other. Editors see others' changes after a reload.
- **Sharing only works with existing accounts.** No invitation emails. The "no account uses that email" message reveals whether an email is registered to any signed-in user (accepted trade-off; would add rate limiting).
- **Search covers titles only**, not content.
- **Import is client-side conversion** of `.txt`/`.md` only. Markdown images and raw HTML are intentionally dropped.
- **No ownership transfer, folders, version history, or comments.**
- **Supabase free tier**: the project pauses after a week of inactivity, and the built-in mailer is rate-limited. Email confirmation is off for this demo.
- **The browser E2E script is not committed** as a CI test. It was run manually with `playwright-core` + Edge; the committed automated tests are Vitest.

## Next steps (another 2–4 hours)

1. Real-time co-editing with Yjs + Tiptap Collaboration over Supabase Realtime, plus presence avatars. This would replace last-write-wins.
2. An optimistic-concurrency check on save (`updated_at` precondition) as an interim conflict guard.
3. Commit the Playwright E2E suite and run it plus the RLS suite in GitHub Actions against a Supabase branch database.
4. Invitations for non-users (pending shares that resolve on sign-up), plus rate limiting on share lookups.
5. Full-text search over content (generated `tsvector` + GIN index), and `.docx` import via `mammoth` with the same allow-list sanitisation.
6. Version history (snapshot table) and ownership transfer.
