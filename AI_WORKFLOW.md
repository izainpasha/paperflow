# AI workflow

## Tools used

- **Claude Code (Claude Opus 5.5)** in VS Code, used as the implementing agent. It inspected the environment, scaffolded the app, wrote the schema, code, tests, and docs, ran every check, and deployed. I directed it, answered decisions that needed me (accounts, credentials, repo visibility), and reviewed the results.
- No other AI tools.

## Where AI helped most

- **Scaffolding and boilerplate**: Next.js setup, Supabase SSR cookie wiring, Tailwind UI, and the loading, empty, and error states.
- **Schema and RLS design**: drafting the migration, policies, helper functions, column-level grants, and the `share_document` RPC.
- **Test authoring**: unit and component tests, plus a live RLS test suite that attacks the database with the public key as a second user.
- **Debugging**: tracking a production-only failure to its root cause (below).
- **Docs**: first drafts of README, ARCHITECTURE, and this file, edited for accuracy against what actually ran.

## Verifying against installed versions instead of memory

The project uses very recent majors (Next.js 16.4, React 19.3, Tiptap 3.32, @supabase/ssr 0.12, zod 4, Vitest 5). Before writing code, the agent read the docs bundled in `node_modules/next/dist/docs` and the installed type definitions. That changed several things:
- Next 16 renamed `middleware.ts` to **`proxy.ts`**, and `params`/`searchParams`/`cookies()` are async only.
- Supabase recommends **`getClaims()`** (verifies the JWT) over `getSession()` on the server, so that's what's used.
- Tiptap 3's StarterKit already includes Underline and Link, so no extra packages were needed.

## AI output that was changed or rejected (what actually happened)

1. **Autosave silently failing for formatted text (bug in AI-written code, caught by E2E).** The first editor implementation passed `editor.getJSON()` straight to a Server Action. Unit tests passed, but the browser E2E run showed "Not saved: Invalid document content: attrs must be an object". Capturing the request body showed `"attrs":"$T"`: ProseMirror's `attrs` aren't plain objects, so React serialised them as opaque *temporary references*. The server-side validator correctly rejected them. Fix: `toPlainJson()` before every Server Action call (editor and import), plus a regression test. This is why the E2E run mattered: jsdom-only tests could not catch it.
2. **Scaffold defaults rejected.** `create-next-app` enabled `cacheComponents` and `partialPrefetching`. For an app where every route is per-user and cookie-authenticated, those add complexity and a risk of serving one user's data from a shared cache, so they were turned off (reasoning in ARCHITECTURE.md).
3. **Recursive autosave rejected by lint.** The first `useAutosave` called itself recursively; the React Compiler lint rule (`react-hooks/immutability`) flagged it, and it was rewritten as a loop.
4. **Test assumptions corrected.** A test expected `<h1>…</h1>` exactly, but StarterKit's `trailingNode` appends an empty paragraph, so the assertion was relaxed to match real behaviour. Another E2E check read the wrong `role="alert"` element (Next.js's route announcer also uses that role), so the selector was scoped.
5. **Import rejected real-world Markdown (found by me during manual testing).** Importing `SUBMISSION.md` failed with "links must use http, https or mailto": the editor accepted relative links like `[VIDEO_URL.txt](VIDEO_URL.txt)`, but the server allow-list (correctly) did not. Fix: the editor's link rule now uses the same `SAFE_HREF` regex as the server, so relative links import as plain text. A client-side `normalizeContent()` strips any other unsupported values (e.g. a pasted "Comic Sans" font) before saving instead of blocking autosave. A regression test imports every Markdown file in this repo.
6. **Toolbar scope expanded after my review.** The first toolbar covered only the spec's minimum. I asked for font selection, indentation, and more. The agent added Tiptap's official text-style/text-align extensions plus a small custom paragraph-indent extension (Tiptap only ships list nesting), with every style value allow-listed on the server so formatting can't be used to inject CSS.
7. **A deploy failed on a test-file type error** that `vitest` didn't catch (Vitest doesn't type-check; `next build` does). The failed Vercel build left the previous version serving; it was fixed and redeployed, and `npm run check` includes `typecheck` for this reason.
8. **A live RLS test went stale (found in the final audit).** "Profiles are not enumerable" asserted that Bob could see only himself. After a demo document was shared from Alice to Bob, Bob legitimately sees Alice's email, so the test failed. A database check confirmed nothing was leaking. The test now asserts the actual rule (you see yourself plus the people you share with), derived from live data.
9. **A wrong documentation claim (found in the final audit).** The docs said email confirmation was disabled; querying the Supabase auth settings showed it was still enabled. The docs were corrected; after I disabled the setting, it was re-verified through the auth settings endpoint and a real sign-up on the live app.
10. **Infrastructure fixes.** The direct Postgres host is IPv6-only and unreachable from the dev network, so the migration was applied through Supabase's IPv4 session pooler. The pasted connection string also still had the template's `[ ]` around the password.

## How correctness and UX were verified

| Check | Result |
|---|---|
| `npm run lint` | clean |
| `npm run typecheck` (strict) | clean |
| `npm test` | 41 unit/component tests passing (earlier revisions of this file said 29, then 39; tests were added as features were added) |
| `npm run test:integration` (live Supabase, two real users, public key only) | 7/7 passing |
| `npm run build` | passing |
| Browser E2E (Edge via playwright-core, script kept outside the repo) against the local production build | 25/25 checks |
| Same E2E against the deployed Vercel URL | 26/26 checks (an early run failed one step because the test waited a fixed 1.5 s for a permission change; it now waits for the recipient to see "Can edit") |

The E2E checks covered: route guard; wrong-password error; create; rename; H1/bold/underline/bullets; autosave status; persistence after reload; unknown-email and duplicate share handling; `.pdf` rejection; `.md` import preserving structure; title search; recipient sees "Shared with Me" with owner and badge; viewer is read-only with no toolbar or share button; recipient gets "Document not available" for a private doc's URL; upgrading to editor lets the recipient's edit reach the owner; no horizontal overflow at 390px. Screenshots from these runs are in `docs/screenshots/`.

Security was checked by attacking the deployed database directly (the RLS suite), not just by checking that UI controls are hidden.
