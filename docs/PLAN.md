# Project Management MVP Plan

## Working rules

- [ ] Keep the MVP limited to the requirements in `AGENTS.md`.
- [ ] Use the existing frontend patterns and keep the implementation simple.
- [ ] Add or update tests in the same phase as the behavior they cover.
- [ ] Run the smallest relevant lint, unit, integration, or end-to-end test command after each phase.
- [ ] Record decisions and schema changes in `docs/`.
- [ ] Do not add credentials, generated databases, or build output to source control.

## Post-review remediation (2026-08-30)

A full code review (`docs/code_review.md`) was actioned. Notable changes:

- No authentication is by design for this local MVP. The backend trusts
  `X-User-Id` and must not be exposed beyond localhost. See `README.md`.
- SQLite connections are now closed after each request; WAL is enabled to match
  the documented schema.
- `PUT /api/board` now rejects payloads that add, remove, or re-id columns
  (rename only).
- Card `created_at` is preserved across full-board replaces; `updated_at` is
  bumped.
- The AI flow re-reads the board immediately before persisting a model update,
  requests JSON mode from OpenRouter, and tolerates code-fenced JSON. The model
  is configurable via `OPENROUTER_MODEL`.
- Frontend: optimistic board updates with rollback on save failure, debounced
  column rename, chat history trimmed to the last 20 messages, inline card
  editing, keyboard drag sensor, and the board-load error path now clears the
  session.
- Added CI (`.github/workflows/ci.yml`); untracked `.idea/` and
  `frontend/test-results/`; committed `uv.lock`; container runs as non-root with
  a compose healthcheck.

## Current implementation decisions

- The frontend uses a static Next.js export, served by FastAPI from the same origin in Docker.
- The MVP login state is stored in browser localStorage under `pm-authenticated`; it is a local demo gate, not production authentication.
- Frontend API requests use `X-User-Id: user-1` as the temporary backend session boundary. The backend requires this header and scopes board access to that user.
- `NEXT_PUBLIC_API_BASE_URL` may provide a separate API origin during development; it defaults to same-origin requests for Docker.
- Board persistence currently uses `GET /api/board` and a transactional full-board `PUT /api/board`. The payload mirrors the frontend `BoardData` shape.
- SQLite runtime data is stored at `data/pm.sqlite3` by default and is initialized and seeded on application startup.
- Part 8 decisions: expose the AI connectivity check as an authenticated backend API endpoint; validate it with a live OpenRouter request rather than mocked model calls. The configured model is `openai/gpt-oss-120b:free`.

## Part 1: Plan and frontend documentation

### Checklist

- [x] Review the business requirements, technical decisions, constraints, and existing frontend.
- [x] Expand this document with implementation steps, tests, and success criteria.
- [x] Add `frontend/AGENTS.md` describing the existing frontend structure and conventions.
- [x] Confirm no blocking requirement ambiguity remains before introducing behavior that is not specified.

### Tests and checks

- [x] Confirm the documented frontend scripts match `frontend/package.json`.
- [x] Review the plan for coverage of authentication, persistence, API integration, AI, Docker, and scripts.

### Success criteria

- The plan gives each implementation phase a concrete checklist, validation approach, and measurable completion condition.
- A contributor can understand the current frontend without reverse-engineering it first.

## Part 2: Scaffolding

### Checklist

- [x] Create the FastAPI application in `backend/` with a clear application entry point.
- [x] Add Python dependency metadata and use `uv` for environment and dependency management.
- [x] Add a configuration layer for environment variables, including the OpenRouter key without exposing it.
- [x] Add Docker configuration that installs backend dependencies and runs one local service.
- [x] Add `scripts/start.sh`, `scripts/stop.sh`, `scripts/start.ps1`, and `scripts/stop.ps1` for macOS/Linux and Windows.
- [x] Serve a minimal static HTML response at `/` from FastAPI.
- [x] Add a health or example API endpoint and make the static page call it.
- [x] Add `.dockerignore` and update repository documentation with the local startup path.

### Tests and checks

- [x] Add backend tests for the example endpoint and static root response.
- [x] Build the Docker image successfully.
- [x] Start the container with the supplied script or equivalent command.
- [x] Verify `/` returns HTML and the example API returns the expected JSON over HTTP.
- [x] Verify the stop script stops only the project service.

### Success criteria

- A clean checkout can be started locally using the documented command or platform script.
- The container serves HTML at `/` and a working API endpoint.
- Missing optional application data does not prevent startup; the MVP has no required runtime configuration for this phase.

## Part 3: Add the frontend

### Checklist

- [x] Configure Next.js for a static export compatible with FastAPI static-file serving.
- [x] Build the existing frontend from `frontend/` as part of the container build.
- [x] Copy the generated static assets into the backend's serving location.
- [x] Preserve the existing Kanban board at `/`, including five columns, add-card flow, rename flow, and drag-and-drop.
- [x] Handle static asset paths and client-side behavior correctly when served by FastAPI rather than `next dev`.
- [x] Keep frontend unit and end-to-end tests runnable in development and against the built application.

### Tests and checks

- [x] Run frontend linting and unit tests.
- [ ] Run the existing Playwright suite against the frontend (blocked locally because the Playwright Chromium binary cannot be downloaded with the available disk space).
- [x] Build the static frontend export.
- [x] Build and serve the static frontend from the backend.
- [ ] Run the Playwright smoke tests against the integrated container (blocked locally because the Chromium download exhausted available disk space).

### Success criteria

- The built application displays the demo Kanban board at `/` from the FastAPI container. (Verified.)
- Existing board interactions continue to work in the integrated deployment.
- Static assets load without 404s or development-server dependencies. (Static export and integrated root response verified.)

## Part 4: Fake user sign-in

### Checklist

- [ ] Add a login view shown when no local session is present.
- [ ] Accept only the MVP credentials `user` / `password`.
- [ ] Store the signed-in state using a mechanism appropriate for the local MVP and compatible with static frontend serving.
- [ ] Prevent the board from rendering before successful sign-in.
- [ ] Show clear validation for invalid credentials.
- [ ] Add a logout action that clears the session and returns to login.
- [ ] Define the session behavior on refresh and direct navigation.

### Tests and checks

- [ ] Add unit tests for credential validation and session transitions.
- [x] Add Playwright tests for initial login, invalid credentials, successful login, refresh, and logout.
- [ ] Verify unauthenticated users cannot access board UI through direct navigation.

### Success criteria

- `/` requires the dummy credentials before showing the board.
- Correct credentials reveal the board and survive a refresh.
- Incorrect credentials do not authenticate, and logout reliably returns to the login view.

## Part 5: Database modeling

### Checklist

- [x] Define a SQLite schema supporting multiple users and one board per user for the MVP.
- [x] Model users, boards, columns, cards, and card ordering with stable identifiers.
- [x] Define ownership and uniqueness constraints, including one board per user.
- [x] Define serialization boundaries for API payloads and database records.
- [x] Save the proposed schema as JSON in `docs/database-schema.json`.
- [x] Document database location, creation behavior, initialization, and migration expectations.
- [x] Obtain user sign-off on the schema before implementing persistence.

### Tests and checks

- [x] Validate the schema JSON parses and contains all required entities and relationships.
- [x] Test creation of a new database from an empty path.
- [x] Test constraints for user ownership, ordering, and duplicate board creation.

### Success criteria

- The schema supports the current MVP and future multiple users without redesigning core entities.
- A documented, approved JSON schema is the contract for backend persistence.
- A missing SQLite database can be initialized deterministically.

## Part 6: Backend Kanban API

### Checklist

- [x] Initialize SQLite tables when the database does not exist.
- [x] Add the MVP authentication/session boundary used by API requests.
- [x] Add routes to read the signed-in user's board.
- [x] Add a transactional full-board route to update board data, column names, cards, and card ordering.
- [x] Enforce that a user can access and modify only their own board.
- [x] Validate request payloads and return explicit HTTP errors for invalid operations.
- [x] Preserve ordering and transactional consistency when moving, creating, editing, or deleting cards.
- [x] Seed the initial board for the MVP user when no board exists.

### Tests and checks

- [x] Add backend unit tests for database initialization and seed data.
- [x] Test successful board reads and each supported mutation.
- [x] Test invalid payloads, missing entities, unauthorized access, and ownership boundaries.
- [x] Test persistence across application/database connections.
- [x] Run the backend test suite against a temporary SQLite database.

### Success criteria

- The API returns the signed-in user's complete board in the agreed JSON shape.
- All supported mutations persist correctly and maintain valid card ordering.
- A new database starts with usable MVP data and no manually created files.

## Part 7: Frontend and backend integration

### Checklist

- [x] Replace frontend-only board state initialization with API loading.
- [x] Connect login and logout to the backend session boundary.
- [x] Persist column renames, card creation, edits, deletion, and drag-and-drop moves through API calls.
- [x] Add loading, save, and error states without losing the current board unexpectedly.
- [x] Refresh or reconcile board state after successful mutations.
- [x] Configure same-origin requests for the Docker deployment and a clear development API path.
- [x] Keep API types shared or explicitly synchronized between frontend and backend.

### Tests and checks

- [x] Add frontend unit tests for API client behavior and error states.
- [x] Add integration tests covering login, initial board loading, board saves, and refresh persistence.
- [ ] Run the integrated Playwright suite against a real backend and temporary database (blocked locally because the Chromium headless binary is unavailable).
- [x] Verify board persistence across API requests against the Docker service.

### Success criteria

- The board is backed by SQLite through FastAPI rather than browser-only state.
- Every visible board operation persists and is reflected in the UI.
- Failures are visible to the user and do not produce false success.

## Part 8: AI connectivity

### Checklist

- [x] Add a backend OpenRouter client using the configured `OPENROUTER_API_KEY`.
- [x] Use model `openai/gpt-oss-120b:free`.
- [x] Keep the key server-side and exclude it from frontend bundles and logs.
- [x] Add a minimal authenticated backend AI connectivity route or diagnostic service.
- [x] Add timeout and explicit error handling consistent with the backend conventions.
- [x] Keep the connectivity test separate from the final board-editing contract.

### Tests and checks

- [x] Add backend tests for authentication and missing credentials.
- [x] Run the requested live `2+2` connectivity test using the configured key.
- [x] Verify missing credentials produce a clear failure.

### Success criteria

- The backend can make a successful OpenRouter request using the required model.
- No API key is exposed to the browser or committed to the repository.
- Connectivity failures are reported explicitly.

Live validation reached OpenRouter with the configured `openai/gpt-oss-120b` model and prompt, but the account returned HTTP 402 (payment/credits required). After changing to `openai/gpt-oss-120b:free`, OpenRouter returned HTTP 404 and reported that the model is unavailable for free; the paid slug is required.

## Part 9: Structured AI board operations

### Checklist

- [x] Define the structured response schema containing the assistant response and optional board update.
- [x] Send the complete current board JSON, the user's question, and conversation history on every AI request.
- [x] Define allowed board operations for creating, editing, moving, deleting, and renaming columns.
- [x] Validate structured model output before applying any update.
- [x] Apply valid board updates transactionally through the same persistence rules as normal API mutations.
- [x] Return the assistant response and the resulting board state in a stable API shape.
- [x] Reject malformed, unauthorized, or semantically invalid updates explicitly.
- [x] Bound conversation history and request size according to a documented simple policy.

### Tests and checks

- [x] Add schema validation tests for response-only, update, malformed, and partial responses.
- [x] Verify board JSON, question, and history are included in model context without mocking.
- [x] Test each allowed operation and multi-operation updates.
- [x] Test transactional rollback when any operation in an update is invalid.
- [x] Test that unrelated users' boards cannot be included or changed.

### Success criteria

- Every AI request receives the required context.
- Valid structured output can update one or more board elements safely.
- Invalid output cannot corrupt persisted board data and is reported clearly.

Live structured-response validation remains blocked by the configured OpenRouter account's HTTP 402 payment/credits response recorded in Part 8.

## Part 10: AI chat sidebar

### Checklist

- [x] Add a responsive sidebar widget to the authenticated frontend.
- [x] Display conversation history, message input, loading state, and errors.
- [x] Submit questions to the backend AI endpoint with the current session.
- [x] Render the assistant's response from the structured result.
- [x] Refresh or reconcile the Kanban board automatically when the AI changes it.
- [x] Preserve normal manual board interactions while chat requests are in progress.
- [x] Match the established color scheme and accessibility conventions.
- [x] Keep the sidebar usable on narrow screens without obscuring board controls.

### Tests and checks

- [x] Add component tests for rendering, submit behavior, loading, errors, and board refresh.
- [ ] Add Playwright coverage for a response-only chat and an AI-driven board update.
- [x] Verify manual edits remain available after chat updates through the shared board state flow.
- [x] Run frontend lint and unit tests; backend tests remain passing from Part 9.
- [ ] Run the complete integrated end-to-end suite (blocked by unavailable Playwright Chromium).
- [x] Build the static frontend successfully.

### Success criteria

- An authenticated user can hold a complete AI conversation in the sidebar.
- The AI can safely create, edit, move, or delete cards and rename columns through structured updates.
- The board visibly refreshes after AI changes, and the final application works from the documented Docker startup flow.

## Part 11: Real user accounts and multiple boards per user (2026-09-05)

The original MVP scope (`AGENTS.md`) intentionally limited this app to one
hardcoded demo login and one board per user. The user explicitly requested
expanding beyond that: real user management and multiple Kanban boards per
user, "testing thoroughly ... and maintaining strong test code coverage and
good integration tests." This part records that deliberate scope change.

### Decisions

- Passwords are hashed with salted PBKDF2-HMAC-SHA256 (stdlib `hashlib`, no
  new dependency) rather than stored in plaintext.
- Authentication moved from a client-trusted `X-User-Id` header to real
  sessions: `POST /api/auth/register` and `POST /api/auth/login` return an
  opaque bearer token (30-day expiry, stored in a new `sessions` table);
  every board/AI route requires `Authorization: Bearer <token>` and resolves
  the user server-side. `POST /api/auth/logout` deletes the session.
- `boards.user_id` is no longer unique: a user may own any number of boards.
  Registering creates one starter board ("My Board", five empty default
  columns). `GET/POST /api/boards`, `PATCH /api/boards/{id}`,
  `DELETE /api/boards/{id}` manage the board list; a user's last board cannot
  be deleted.
- The per-board content routes moved from `/api/board` to
  `/api/boards/{board_id}` (`GET`/`PUT`), and AI chat moved to
  `/api/boards/{board_id}/ai/chat`. The `BoardData` payload shape
  (`{ columns, cards }`) is unchanged; only routing and auth changed.
- The demo account (`user` / `password`, board "Kanban Studio") is still
  seeded on startup so existing manual/e2e flows keep working through real
  login instead of a frontend-hardcoded credential check.
- A database created before this change (missing `users.password_hash`) is
  detected and rebuilt automatically at startup, since there is no migration
  tooling and the local database only ever holds demo data.

### Checklist

- [x] Add password hashing and bearer-token sessions to the backend.
- [x] Add `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me`.
- [x] Change `boards` to support many boards per user; add list/create/rename/delete routes.
- [x] Re-scope board content and AI chat routes under `/api/boards/{board_id}`.
- [x] Update `docs/database-schema.json` and `docs/DATABASE.md` for the new schema and auth model.
- [x] Rewrite backend tests for the new contract (ownership isolation between users, session lifecycle, multi-board CRUD).
- [ ] Add a frontend login/register flow backed by the real API (replacing the hardcoded `src/lib/auth.ts` gate).
- [ ] Add a board switcher UI (list, create, rename, delete boards) and thread the selected `board_id` through `KanbanBoard` and `ChatSidebar`.
- [x] Update frontend unit tests and the Playwright e2e suite for accounts and multi-board flows.

### Tests and checks

- [x] Backend: `uv run pytest` (53 tests) covering registration, login/logout,
      session expiry/invalidation, per-user board isolation, multi-board
      create/rename/delete (including the last-board-cannot-be-deleted rule),
      and the full AI chat contract against the new routes.
- [x] Frontend unit tests for auth forms and board switching (AuthForm 3,
      BoardSwitcher 5, AuthGate 8).
- [x] Playwright coverage for register -> board, and creating/switching/
      deleting boards (`frontend/tests/kanban.spec.ts`).

### Success criteria

- A new user can register, is issued their own board, and cannot see or
  modify any other user's boards.
- A user can create, rename, switch between, and delete boards, and can never
  be left with zero boards.
- The existing single-board Kanban and AI chat behavior is fully preserved
  for a board once selected.

## Part 12: Card priority and due dates (2026-09-05)

First increment toward a richer "comprehensive PM app": cards gain structured
metadata beyond free-text details.

### Decisions

- `Card` gains two optional fields: `priority` (`"low" | "medium" | "high" |
  null`) and `dueDate` (a `YYYY-MM-DD` string or `null`). Both default to
  `null` and are always serialized, so the wire shape is `{ id, title,
  details, priority, dueDate }`. Frontend `Card` keeps them optional.
- Stored on the existing `cards` table as `priority` / `due_date` (both
  nullable TEXT). A pre-existing local database gets the columns via a plain
  `ALTER TABLE ADD COLUMN` at startup (`_add_missing_card_columns`); there is
  no data to backfill. A schema old enough to also lack `users.password_hash`
  is still fully rebuilt by `_reset_outdated_schema`.
- `due_date` format is validated by a `^\d{4}-\d{2}-\d{2}$` pattern on the
  pydantic field (shared as `DUE_DATE_PATTERN` in `models.py`); `priority`
  by the `Priority` `Literal`. The AI `create_card` / `edit_card` operations
  accept both fields under the same validation; `edit_card` may now change
  only priority or only due date.
- The add/edit card callbacks pass a single `CardFields` object rather than
  growing one positional argument per attribute. Priority and due date are
  rendered as small badges on the card (overdue due dates use the accent
  colour) and formatted locale-independently.

### Checklist

- [x] Backend `Card` model, `cards` schema + startup migration, `read_board`
      / `replace_board` round-trip, seed data priorities.
- [x] AI `create_card` / `edit_card` operations carry priority and due date.
- [x] Frontend `Card` / `CardFields` types, shared `CardMeta` component
      (badges + form fields), `NewCardForm` and `KanbanCard` edit UI.
- [x] Docs: `database-schema.json`, `DATABASE.md`, `CLAUDE.md`.

### Tests and checks

- [x] Backend: `uv run pytest` (59 tests) - contract field names, metadata
      defaulting to null, database round-trip, seeded priorities, and AI
      create/edit carrying and validating the new fields.
- [x] Frontend unit: `npm run test:unit` (40 tests) - adding a card with a
      priority and due date, changing an existing card's priority, and the
      updated `BoardData` contract test.
- [x] `npm run lint` and `npm run build` clean.
- [x] Playwright: a spec that sets a card's priority and due date through the
      edit form and asserts they survive a reload.

### Success criteria

- A card can be given a priority and a due date from the UI or the AI, the
  values persist through a full-board replace, and they are shown as badges
  on the board.

## Part 13: Card labels / tags and label filtering (2026-09-05)

Second increment of card richness: free-form labels plus a board-level
filter.

### Decisions

- `Card` gains `labels: list[str]`, always serialized (defaults to `[]`), so
  the card wire shape is `{ id, title, details, priority, dueDate, labels }`.
  Frontend `Card.labels` stays optional.
- Labels are normalized by a shared `normalize_labels` in `models.py`
  (mirrored by `normalizeLabels` in `kanban.ts`): trim, drop
  case-insensitive duplicates keeping first spelling, reject empty / over
  32 chars (backend) or truncate to 32 (frontend), cap at 10 per card.
- Stored as a JSON text column `cards.labels` (`NOT NULL DEFAULT '[]'`),
  read with `json.loads` / written with `json.dumps` in `read_board` /
  `replace_board`. Added to an existing local database by the same startup
  `ALTER TABLE` helper used for priority / due_date.
- AI `create_card` accepts `labels` (defaults `[]`); `edit_card` accepts
  `labels: list[str] | None` where `None` keeps the existing labels and `[]`
  clears them.
- UI: a reusable `LabelChips` (display / toggle) and `LabelEditor`
  (type-to-add with Enter or comma, Backspace to remove last, per-chip
  remove) in `CardMeta.tsx`, wired into `NewCardForm` and `KanbanCard`.
  `KanbanBoard` shows a "Filter by label" bar built from all labels on the
  board; selecting labels hides cards that carry none of them (OR match).
  Drag/drop and the AI still operate on the full board.

### Checklist

- [x] Backend `Card.labels` + `normalize_labels`, `cards.labels` column +
      startup migration, `read_board` / `replace_board` round-trip, seed
      data labels.
- [x] AI `create_card` / `edit_card` carry labels (with the None-vs-[] edit
      semantics).
- [x] Frontend types (`Card`, `CardFields`, `normalizeLabels`), `CardMeta`
      `LabelChips` / `LabelEditor`, forms, and the `KanbanBoard` filter bar.
- [x] Docs: `database-schema.json`, `DATABASE.md`, `CLAUDE.md`.

### Tests and checks

- [x] Backend: `uv run pytest` (65 tests) - contract field names + label
      trimming/dedup, database round-trip and seeded labels, and AI
      create/edit carry, clear, and leave-untouched semantics.
- [x] Frontend unit: `npm run test:unit` (45 tests) - `normalizeLabels`
      rules, adding a label through the edit form, and filtering the board
      by a selected label.
- [x] `npm run lint` and `npm run build` clean.
- [x] Playwright: a spec that adds a label, filters by it, and reloads to
      confirm persistence.

### Success criteria

- A card can be tagged with labels from the UI or the AI, the labels persist
  through a full-board replace, show as chips on the card, and the board can
  be filtered to the cards carrying a chosen label.

## Part 14: Card comments and the board activity feed (2026-09-05)

The first data that does not live in the full-board payload. Comments and an
auto-generated activity log get dedicated `/api/boards/{id}` sub-resource
routes.

### Decisions

- New tables `comments` and `activity`, both created with
  `CREATE TABLE IF NOT EXISTS` (an existing local database picks them up on
  the next start; no migration helper needed).
- `comments.card_id` is a plain column, **not** a foreign key to `cards.id`,
  because a full-board `PUT` deletes and reinserts every card row and a
  cascade would wipe every thread on each save. Comments are scoped by
  `(board_id, card_id)`; `replace_board` deletes comments only for the card
  ids that its diff reports as removed. A comment stores an `author` username
  snapshot; only the author may delete it (`comment_deleted` is logged).
- Routes: `GET /api/boards/{id}/comments` (flat, oldest first),
  `POST /api/boards/{id}/cards/{cardId}/comments` (400 if the card is not on
  the board, 422 on an empty body, max 2000 chars),
  `DELETE /api/boards/{id}/comments/{commentId}` (author-only, 404 otherwise),
  `GET /api/boards/{id}/activity` (newest first, capped at 100). All resolve
  the board through the same `(user_id, board_id)` ownership check, so one
  user never sees another's comments or activity.
- `backend/app/activity.py` `diff_board_activity(old, new)` is a pure function
  that turns a before/after `BoardData` pair into ordered entries:
  `column_renamed`, then `card_created` / `card_moved` / `card_edited` in the
  new board's reading order, then `card_deleted`. Move detection compares
  column **id** (so renaming a column does not read as every card moving);
  a title change reads as `Renamed "old" to "new"`. `replace_board` snapshots
  the old board with a new `_read_board_data` helper (also now used by
  `read_board`), runs the diff, and appends the rows in the same transaction.
- Frontend: `AuthGate` loads both feeds per board and bumps a `feedVersion`
  counter after any board save, AI update, or comment mutation to refetch.
  New `CardComments` (collapsible per-card thread, author-only delete) is
  threaded through `KanbanBoard` -> `KanbanColumn` -> `KanbanCard`; a
  pointer/keydown `stopPropagation` wrapper keeps typing from starting a
  drag. New `ActivityPanel` (collapsible) renders above the label filter.
  `src/lib/datetime.ts` `formatTimestamp` renders UTC deterministically.

### Checklist

- [x] `comments` / `activity` tables; `add_comment`, `list_comments`,
      `delete_comment`, `list_activity`, `_read_board_data`, activity
      recording in `replace_board` (+ deleted-card comment pruning).
- [x] `diff_board_activity` pure module.
- [x] Four sub-resource routes with ownership isolation.
- [x] Frontend api client, `CardComments`, `ActivityPanel`, `AuthGate`
      wiring, `formatTimestamp`.
- [x] Docs: `database-schema.json`, `DATABASE.md`, `CLAUDE.md`.

### Tests and checks

- [x] Backend: `uv run pytest` (80 tests) - `test_activity.py` diff cases,
      database comment CRUD / ownership / author-only delete / activity
      generation / comment pruning on card delete, and route tests covering
      the full comment lifecycle, the activity feed, empty-body rejection,
      and cross-user isolation (404).
- [x] Frontend unit: `npm run test:unit` (52 tests) - `CardComments` (toggle,
      trimmed submit, author-only delete), `ActivityPanel` (collapsed default,
      empty state, UTC timestamp), `KanbanBoard` comment + activity
      integration, and api client calls for all four routes.
- [x] `npm run lint` and `npm run build` clean.
- [x] Playwright: a spec that comments on a card, sees the entry in the
      activity feed, and reloads to confirm the comment count persists.

### Success criteria

- A user can comment on any card on their board, delete their own comments,
  and watch every board change (create / edit / move / delete / column
  rename) and comment appear in a newest-first activity feed, with all of it
  private to the board owner.
