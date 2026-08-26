# Project Management MVP Plan

## Working rules

- [ ] Keep the MVP limited to the requirements in `AGENTS.md`.
- [ ] Use the existing frontend patterns and keep the implementation simple.
- [ ] Add or update tests in the same phase as the behavior they cover.
- [ ] Run the smallest relevant lint, unit, integration, or end-to-end test command after each phase.
- [ ] Record decisions and schema changes in `docs/`.
- [ ] Do not add credentials, generated databases, or build output to source control.

## Current implementation decisions

- The frontend uses a static Next.js export, served by FastAPI from the same origin in Docker.
- The MVP login state is stored in browser localStorage under `pm-authenticated`; it is a local demo gate, not production authentication.
- Frontend API requests use `X-User-Id: user-1` as the temporary backend session boundary. The backend requires this header and scopes board access to that user.
- `NEXT_PUBLIC_API_BASE_URL` may provide a separate API origin during development; it defaults to same-origin requests for Docker.
- Board persistence currently uses `GET /api/board` and a transactional full-board `PUT /api/board`. The payload mirrors the frontend `BoardData` shape.
- SQLite runtime data is stored at `data/pm.sqlite3` by default and is initialized and seeded on application startup.

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

- [ ] Add a backend OpenRouter client using the configured `OPENROUTER_API_KEY`.
- [ ] Use model `openai/gpt-oss-120b`.
- [ ] Keep the key server-side and exclude it from frontend bundles and logs.
- [ ] Add a minimal backend AI connectivity route or diagnostic service.
- [ ] Add timeout and explicit error handling consistent with the backend conventions.
- [ ] Keep the connectivity test separate from the final board-editing contract.

### Tests and checks

- [ ] Add mocked backend tests for request construction, model selection, and response handling.
- [ ] Run the requested live `2+2` connectivity test only when the key is available.
- [ ] Verify missing or invalid credentials produce a clear failure.

### Success criteria

- The backend can make a successful OpenRouter request using the required model.
- No API key is exposed to the browser or committed to the repository.
- Connectivity failures are reported explicitly.

## Part 9: Structured AI board operations

### Checklist

- [ ] Define the structured response schema containing the assistant response and optional board update.
- [ ] Send the complete current board JSON, the user's question, and conversation history on every AI request.
- [ ] Define allowed board operations for creating, editing, moving, deleting cards, and renaming columns.
- [ ] Validate structured model output before applying any update.
- [ ] Apply valid board updates transactionally through the same persistence rules as normal API mutations.
- [ ] Return the assistant response and the resulting board state in a stable API shape.
- [ ] Reject malformed, unauthorized, or semantically invalid updates explicitly.
- [ ] Bound conversation history and request size according to a documented simple policy.

### Tests and checks

- [ ] Add schema validation tests for response-only, update, malformed, and partial responses.
- [ ] Mock model calls and verify board JSON, question, and history are included.
- [ ] Test each allowed operation and multi-operation updates.
- [ ] Test transactional rollback when any operation in an update is invalid.
- [ ] Test that unrelated users' boards cannot be included or changed.

### Success criteria

- Every AI request receives the required context.
- Valid structured output can update one or more board elements safely.
- Invalid output cannot corrupt persisted board data and is reported clearly.

## Part 10: AI chat sidebar

### Checklist

- [ ] Add a responsive sidebar widget to the authenticated frontend.
- [ ] Display conversation history, message input, loading state, and errors.
- [ ] Submit questions to the backend AI endpoint with the current session.
- [ ] Render the assistant's response from the structured result.
- [ ] Refresh or reconcile the Kanban board automatically when the AI changes it.
- [ ] Preserve normal manual board interactions while chat requests are in progress.
- [ ] Match the established color scheme and accessibility conventions.
- [ ] Keep the sidebar usable on narrow screens without obscuring board controls.

### Tests and checks

- [ ] Add component tests for rendering, submit behavior, loading, errors, and board refresh.
- [ ] Add Playwright coverage for a response-only chat and an AI-driven board update.
- [ ] Verify manual edits still work after chat updates.
- [ ] Run lint, frontend unit tests, backend tests, and the complete integrated end-to-end suite.
- [ ] Build and run the final Docker image from a clean dependency install.

### Success criteria

- An authenticated user can hold a complete AI conversation in the sidebar.
- The AI can safely create, edit, move, or delete cards and rename columns through structured updates.
- The board visibly refreshes after AI changes, and the final application works from the documented Docker startup flow.
