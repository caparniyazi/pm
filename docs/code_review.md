# Code review

Date: 2026-08-30
Scope: entire repository at commit `3d87f3f` (plus uncommitted e2e fixes on `frontend/`).
Reviewer: automated pass over backend, frontend, infrastructure, tests, and docs.

## Overall assessment

The MVP is well structured for its size. Concerns are cleanly separated (FastAPI
API + static Next.js export, one container), the database contract is documented,
and there is real test coverage on both sides. The code generally follows the
"keep it simple" standard in `AGENTS.md`.

The material problems are:

1. The AI feature does not work end to end with the configured model/account
   (documented in `PLAN.md`), and the JSON-parsing path is fragile.
2. Controlled-board editing has no optimistic UI and saves the entire board on
   every keystroke of a column rename, which will feel broken over a real
   network.
3. Two concrete client bugs: chat breaks permanently after 20 messages, and the
   board-load error path leaves a stale auth session.
4. A SQLite connection leak on every request.
5. Several repository-hygiene issues (tracked IDE files and a tracked test
   artifact, missing `uv.lock`, `data/` not ignored).

None are blocking for a local single-user demo, but items in High should be
fixed before this is shown widely or deployed anywhere non-local.

Severity legend: High = fix soon, Medium = fix when touching the area,
Low = nit / follow-up.

---

## Security and auth model

### S1 (Medium, by design but must be stated) No authentication
`current_user_id()` in `backend/app/main.py` trusts the `X-User-Id` header
verbatim. Any client can read or overwrite any user's board, and can drive AI
board mutations against any user id, by setting a header. The frontend hardcodes
`user-1`. This is acceptable for the stated local MVP but is the single most
important caveat.
- Action: add a one-paragraph "Security model / not for deployment" note to
  `README.md` and `docs/PLAN.md`. If this ever leaves localhost, replace the
  header with a real session (signed cookie or token) before anything else.

### S2 (Low) `POST /api/ai/connectivity` triggers a billed API call
It is gated only by the spoofable header and makes a live OpenRouter request on
every call. On a metered key this is a cheap way to burn credits.
- Action: keep it out of any deployed build, or put it behind a debug flag
  (`settings` field) that is off by default.

### S3 (Low) OpenRouter key handling is correct
The key is read server-side from the environment, injected via
`docker-compose.yml` `env_file`, excluded from the build context by
`.dockerignore`, and never referenced in frontend code. No change needed;
recorded here so the review is explicit about it.

---

## Backend

### B1 (High) SQLite connections are never closed
`connect()` in `backend/app/database.py` returns a connection used as
`with connect(...) as connection:`. The sqlite3 context manager commits or rolls
back the transaction but does **not** close the connection. `read_board` and
`replace_board` each open a fresh connection per call, so every API request
leaks one or two connections until garbage collection.
- Action: wrap in `contextlib.closing`, or add an explicit `try/finally:
  connection.close()`, or use a small module-level helper that both commits and
  closes.

### B2 (High) AI structured-output parsing is brittle
`parse_ai_response()` does `json.loads(raw_response)` directly. The request to
OpenRouter (`backend/app/openrouter.py`) does not set
`response_format={"type": "json_object"}` and the model is only *asked* in the
system prompt to return JSON. Models routinely wrap JSON in ```json fences or add
prose, which makes this fail with a 400 "AI response was not valid structured
JSON". This will be the common case once the key works.
- Action: send `response_format={"type": "json_object"}` in the payload, and as
  a belt-and-braces measure strip a leading/trailing code fence before
  `json.loads`. Consider tool/function calling if the model supports it.

### B3 (High) AI feature is non-functional with the configured model
`MODEL = "openai/gpt-oss-120b:free"` is hardcoded. `PLAN.md` records that the
paid slug returns HTTP 402 (no credits) and the `:free` slug returns HTTP 404
(unavailable). So `POST /api/ai/chat` cannot currently succeed.
- Action: make the model configurable via env (`OPENROUTER_MODEL`, default to a
  slug known to work), and document in `README.md` that the AI feature needs an
  OpenRouter account with credits. Add a short troubleshooting note mapping
  402/404 to "account/model".

### B4 (Medium) Stale-board race in the AI flow
`ai_chat()` reads the board, calls OpenRouter (up to 30s), then calls
`replace_board()` with the board snapshot taken before the network call. Any
manual edit made during that window is silently overwritten (last write wins,
very wide window).
- Action: re-read the board immediately before `replace_board`, or apply the
  operations inside a single transaction that reloads current state first. At
  minimum, note the limitation.

### B5 (Medium) `created_at` on cards is meaningless as implemented
`replace_board()` deletes every card and reinserts it with
`created_at = now()`. The schema and `docs/database-schema.json` present
`created_at` / `updated_at` as real timestamps, but `created_at` is reset on
every save.
- Action: either preserve `created_at` by reading existing rows and carrying the
  value forward, or drop `created_at`/`updated_at` from `cards` and `boards`
  until they are actually needed (simpler, matches "no extra features").

### B6 (Medium) WAL is documented but never enabled
`docs/DATABASE.md` and `docs/database-schema.json` state journal mode WAL, but
`connect()` only sets `PRAGMA foreign_keys = ON`.
- Action: either add `PRAGMA journal_mode = WAL` in `connect()` (once, at init
  is enough since it persists) or correct the docs to say the default rollback
  journal is used.

### B7 (Medium) `PUT /api/board` does not enforce the board invariants
The requirements say the board has fixed columns that can be renamed. The
endpoint lets a client replace the entire column set, change column ids, or
change the column count. `validate_board()` only checks id uniqueness and
card/column referential consistency.
- Action: validate that the incoming column ids match the existing board's
  column ids (rename only), and reject added/removed columns with a 400. This
  also protects the `col-*` ids the frontend and seed data assume.

### B8 (Low) Unknown `/api/*` routes fall through to static files
`app.mount("/", StaticFiles(...))` is the catch-all. A mistyped API path returns
the static 404 behavior rather than a JSON 404.
- Action: optional. Add an explicit `/api/{path:path}` catch-all that returns
  `JSONResponse(status_code=404)` if API 404 hygiene matters.

### B9 (Low) `replace_board` returns the request body, not the persisted row set
The response echoes the input `BoardData` rather than a re-read. `GET` is the
real source of truth. Harmless today because storage does no normalization.
- Action: optional. Return `read_board(...)` after the write for a truthful
  response.

### B10 (Low) Dead code paths
`/api/hello` and `backend/app/static/index.html` exist only as scaffolding.
`index.html` is unreachable in the Docker image (`frontend/out` always present);
it is still used by `test_main.py::test_root_serves_static_html`.
- Action: keep `/api/hello` only if it becomes the compose healthcheck (see I5),
  otherwise remove both and adjust that test.

### B11 (Low) `model_dump(by_alias=True)` with no aliases
`backend/app/ai.py` `build_messages()` passes `by_alias=True`, but the models
define no aliases (`cardIds` is the literal field name). Misleading no-op.
- Action: drop `by_alias=True`, or add real aliases and use them consistently.

---

## Frontend

### F1 (High) Chat breaks permanently after 20 messages
`AIChatRequest.history` has `max_length=MAX_HISTORY_MESSAGES` (20) server-side.
`ChatSidebar` sends the full `messages` array every time. Once the conversation
reaches 20 entries, every request fails pydantic validation with 422 and the
sidebar shows "AI assistant unavailable: Request failed (422)" forever.
- Action: in `ChatSidebar.handleSubmit`, send only the last `N` messages
  (`messages.slice(-20)` or `-19` to leave room). Optionally add a "Clear
  conversation" control.

### F2 (High) No optimistic UI in controlled mode; full save per keystroke
In `KanbanBoard`, controlled mode uses `board = onBoardChange ? initialBoard :
localBoard`. Every mutation calls `onBoardChange` (a full `PUT /api/board`) and
the UI only updates after the round trip resolves and the parent calls
`setBoard`. Two consequences:
- Drag-and-drop and add/delete visibly lag or snap back until the server
  responds; on failure the change is silently dropped (only a small toast).
- `KanbanColumn` calls `onRename` on every `onChange` (keystroke), so typing a
  column name fires one whole-board delete-and-reinsert `PUT` per character.
- Action: hold board state locally in the controlled path too, apply changes
  optimistically, then reconcile with the server response and roll back on
  error. Debounce column rename (or save on blur). This is the biggest
  user-facing issue.

### F3 (Medium) Board-load error path leaves a stale session
`AuthGate`: when `fetchBoard()` fails, the screen offers "Return to sign in"
which calls `setIsAuthenticated(false)` but does not clear
`localStorage["pm-authenticated"]`. On reload the user is "authenticated" again
and hits the same error.
- Action: have that button call `handleLogout` (or clear the storage key)
  instead of only flipping state.

### F4 (Medium) A user cannot edit a card
Requirements list "cards ... can be ... edited". The UI supports add, delete, and
move only (`KanbanCard` has no edit affordance, `NewCardForm` is add-only). Only
the AI `edit_card` operation can change a card.
- Action: add inline title/details editing to `KanbanCard`, routed through the
  same `onBoardChange` path (with F2's optimistic handling).

### F5 (Medium) Keyboard accessibility for drag-and-drop is missing
`KanbanBoard` registers only `PointerSensor`. dnd-kit's `useSortable` sets the
ARIA attributes for keyboard dragging, but without `KeyboardSensor` cards cannot
actually be moved by keyboard. `AGENTS.md` Part 10 calls for accessibility
conventions.
- Action: add `KeyboardSensor` with `sortableKeyboardCoordinates`, or document
  that keyboard DnD is out of scope for the MVP.

### F6 (Low) Default-open fixed chat panel overlaps board controls
`ChatSidebar` starts `isOpen = true` and is `position: fixed`. On narrow screens
it sits at `bottom-4 right-4` over the board; on `lg` it shares the top-right
corner with the "Log out" button.
- Action: start collapsed, or offset the board content when the panel is open,
  or move the logout control.

### F7 (Low) `queueMicrotask` in `AuthGate`
The initial `setIsAuthenticated` is deferred through `queueMicrotask` with no
comment explaining why. `useEffect` already runs after paint.
- Action: remove the indirection or add a one-line comment justifying it.

### F8 (Low) Inconsistent card "details" default
`KanbanBoard.handleAddCard` substitutes `"No details yet."` when details are
empty; the AI path and backend use `""`.
- Action: pick one (prefer `""`) so board data is consistent regardless of
  origin.

### F9 (Low) npm audit reports vulnerabilities
`npm install` reports 16 advisories (2 critical, 12 high) as of this review.
Likely transitive and mostly dev-only, but unreviewed.
- Action: run `npm audit`, record which are runtime vs dev, and `npm audit fix`
  what is safe.

### F10 (Low) `next/font/google` requires network at build time
`layout.tsx` loads Manrope and Space_Grotesk from Google Fonts during
`next build`. A hermetic or offline build (CI without egress) will fail.
- Action: acceptable for now; if reproducible/offline builds become a
  requirement, self-host the fonts under `public/` or `next/font/local`.

### F11 (Low) `package.json` script duplication
`"test"` and `"test:unit"` are identical.
- Action: have `"test"` delegate (`"npm run test:unit"`) or remove one.

---

## Infrastructure and repo hygiene

### I1 (High) IDE project files are tracked
`.idea/` is committed (`git ls-files` shows `.idea/pm.iml`, `misc.xml`, etc.).
The `.gitignore` line for `.idea/` is commented out.
- Action: `git rm -r --cached .idea` and add `.idea/` to `.gitignore`.
  (`.dockerignore` already excludes it from the image.)

### I2 (High) Playwright artifact is tracked
`frontend/test-results/.last-run.json` is committed.
- Action: `git rm --cached frontend/test-results/.last-run.json` and add
  `/test-results/` to `frontend/.gitignore`.

### I3 (High) No `uv.lock`, so backend builds are not reproducible
`pyproject.toml` pins ranges (`fastapi>=0.116,<1`, `uvicorn[standard]>=0.35,<1`)
and no lock file is committed, so `uv sync` in the Dockerfile resolves fresh on
every build.
- Action: run `uv lock`, commit `uv.lock`, and change the Dockerfile to
  `uv sync --no-dev --locked` (or `--frozen`).

### I4 (Medium) `data/` and generic SQLite files are not git-ignored
`.gitignore` only ignores Django's `db.sqlite3`. Running the backend outside
Docker writes `data/pm.sqlite3` into the working tree where it can be committed.
- Action: add `data/` and `*.sqlite3`, `*.sqlite3-*` to `.gitignore`.

### I5 (Medium) Container runs as root, no healthcheck, no restart policy
The final image is based on the uv image and adds no `USER`. `docker-compose.yml`
has no `healthcheck` or `restart`.
- Action: add a non-root `USER` in the Dockerfile; add a compose `healthcheck`
  hitting `/api/hello` (or a dedicated `/healthz`) and `restart: unless-stopped`.

### I6 (Medium) No CI
Nothing runs lint, unit, or integration tests automatically.
- Action: add a GitHub Actions workflow: frontend `npm ci && npm run lint &&
  npm run test:unit && npm run build`, backend `uv sync && uv run pytest`,
  and (optionally) the Playwright suite against the built container.

### I7 (Low) `start` scripts do not check for `.env`
`docker compose up` fails opaquely if `.env` is missing. `README.md` mentions the
requirement but the scripts do not enforce it.
- Action: have `scripts/start.*` print a clear message and exit if `.env` is
  absent.

### I8 (Low) e2e config now depends on Docker
`frontend/playwright.config.ts` (uncommitted change from the e2e fix) runs
`docker compose up --build` as its `webServer` and needs the root `.env`. This
makes `npm run test:e2e` heavier and couples it to Docker.
- Action: accept it (the whole app genuinely needs the backend), but document
  the dependency in `frontend/AGENTS.md`, and gate the e2e job in CI so it does
  not run on every push if that is too slow.

### I9 (Low) `backend/AGENTS.md` and `scripts/AGENTS.md` are placeholders
Both still say "This file should be updated...".
- Action: fill them in or delete them; `CLAUDE.md` now covers most of the
  content.

---

## Testing gaps

### T1 (High) The AI persist path is untested
No test exercises `request_ai_response` -> `apply_board_update` -> `replace_board`
(the `main.py` branch that saves an AI board update). `test_main.py` only covers
missing-key and unauthorized cases; `test_ai.py` covers parse/apply/build in
isolation.
- Action: add a test that stubs `ask_openrouter_messages` to return a canned
  structured response with operations, calls `POST /api/ai/chat`, and asserts the
  persisted board changed (and that an invalid operation rolls back with 400 and
  no persistence).

### T2 (Medium) No contract test that the two `BoardData` shapes match
`backend/app/models.py` and `frontend/src/lib/kanban.ts` define the payload
independently; only manual discipline keeps `cardIds` etc. aligned.
- Action: add a check - e.g. a small fixture JSON asserted by both a pytest and a
  vitest test, or generate the TS types from the pydantic schema.

### T3 (Medium) Thin backend mutation coverage
No tests for `create_card` with a duplicate id via the API, `move_card` position
clamping, `edit_card` with neither field set, or `rename_column` on a missing
column through `POST /api/ai/chat`.
- Action: add focused cases for each allowed operation and its failure mode at
  the API layer.

### T4 (Low) `test_main` AI tests rely on `openrouter_api_key=None`
They confirm the 503 path but never the success path (see T1).

### T5 (Low) e2e drag test is inherently timing-based
The fixed `waitForTimeout(50)` nudges in `kanban.spec.ts` are pragmatic but
fragile on a slow machine. `retries: 1` in the config absorbs most flakes.
- Action: if it flakes in CI, switch to polling for the drag-overlay element
  between moves instead of fixed sleeps.

---

## What is good (keep)

- Clear layering: pure board logic in `kanban.ts` / `models.py`, IO at the edges.
- `replace_board` is a single atomic transaction with sensible validation.
- The database contract is written down and approved (`docs/DATABASE.md`,
  `database-schema.json`) and matches the implemented schema.
- The OpenRouter key is handled correctly (server-only, out of the build).
- Reasonable unit coverage on both sides; tests use tmp databases and mocked
  fetch rather than hitting the network.
- `docs/PLAN.md` is an honest running log, including the blocked items.

---

## Prioritized action checklist

High:
- [ ] B1 Close SQLite connections.
- [ ] B2 Request JSON mode from OpenRouter and tolerate code fences.
- [ ] B3 Make the model configurable; document that AI needs credits.
- [ ] F1 Trim chat history to the last 20 messages before sending.
- [ ] F2 Optimistic board updates in controlled mode; debounce column rename.
- [ ] I1 Untrack `.idea/`; ignore it.
- [ ] I2 Untrack `frontend/test-results/`; ignore it.
- [ ] I3 Commit `uv.lock`; build with `--locked`.
- [ ] T1 Test the AI update-and-persist path (success and rollback).

Medium:
- [ ] S1 Document the "no auth, local only" security model.
- [ ] B4 Re-read the board before applying an AI update.
- [ ] B5 Preserve or remove `created_at` / `updated_at`.
- [ ] B6 Enable WAL or fix the docs.
- [ ] B7 Enforce rename-only columns on `PUT /api/board`.
- [ ] F3 Clear the auth session on the board-load error path.
- [ ] F4 Add card editing to the UI.
- [ ] F5 Add `KeyboardSensor` or scope out keyboard DnD.
- [ ] I4 Ignore `data/` and `*.sqlite3*`.
- [ ] I5 Non-root container user; compose healthcheck and restart policy.
- [ ] I6 Add CI.
- [ ] T2 Contract test for the shared `BoardData` shape.
- [ ] T3 Per-operation API tests for AI board ops.

Low:
- [ ] S2 Gate `/api/ai/connectivity` behind a debug flag.
- [ ] B8 JSON 404 for unknown `/api/*`.
- [ ] B9 Return a re-read board from `PUT`.
- [ ] B10 Remove `/api/hello` and the static fallback, or repurpose for health.
- [ ] B11 Drop `by_alias=True`.
- [ ] F6 Start the chat panel collapsed / stop it overlapping controls.
- [ ] F7 Remove or justify `queueMicrotask` in `AuthGate`.
- [ ] F8 Consistent empty-details default.
- [ ] F9 Triage `npm audit`.
- [ ] F10 Note the build-time font fetch; self-host if offline builds are needed.
- [ ] F11 De-duplicate the `test` / `test:unit` scripts.
- [ ] I7 `.env` presence check in the start scripts.
- [ ] I8 Document the e2e Docker dependency in `frontend/AGENTS.md`.
- [ ] I9 Fill in or delete the placeholder `AGENTS.md` files.
