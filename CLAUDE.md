# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A local-only Project Management MVP: a single-board Kanban app with fake sign-in and an AI chat sidebar that can mutate the board. One Docker container runs a FastAPI backend that serves both the JSON API and the statically exported Next.js frontend on port 8000.

`AGENTS.md` (root) is the authoritative product spec and coding-standards document. `docs/PLAN.md` is the phased implementation plan and running work log; `docs/DATABASE.md` + `docs/database-schema.json` are the approved schema contract. Update `docs/` when decisions or schema change.

## Commands

Backend (Python 3.12, `uv`), run from repo root:

```bash
uv sync                       # install deps (add --no-dev for prod parity)
uv run pytest                 # full backend suite (testpaths = backend/tests)
uv run pytest backend/tests/test_ai.py::test_build_messages_includes_board_question_and_history
uv run uvicorn backend.app.main:app --reload   # run API alone on :8000
```

Frontend (Node, Next.js), run from `frontend/`:

```bash
npm install
npm run dev                   # next dev on :3000
npm run lint                  # eslint (also the only formatter/style gate)
npm run test:unit             # vitest, src/**/*.{test,spec}.{ts,tsx}
npm run test:e2e              # playwright, frontend/tests/ (see note below)
npm run build                 # static export -> frontend/out/
```

Run a single vitest file: `npm run test:unit -- src/lib/api.test.ts`.

Full app (Docker):

```bash
./scripts/start.sh            # or scripts/start.ps1 on Windows; docker compose up --build -d
./scripts/stop.sh             # docker compose down
```

Requires `OPENROUTER_API_KEY` in the root `.env` (git-ignored). Optional env: `OPENROUTER_MODEL` (default `openai/gpt-oss-120b`), `DATABASE_PATH` (default `data/pm.sqlite3`). Open http://localhost:8000.

Playwright e2e (`frontend/tests/`) drives the full stack, so `playwright.config.ts` starts the app with `docker compose up --build` and needs the root `.env`. It reuses an already-running container.

## Architecture

### One process, two roles

`backend/app/main.py` mounts `StaticFiles` from `frontend/out/` at `/` when that directory exists (the Docker build copies it there), otherwise falls back to `backend/app/static/index.html`. All API routes live under `/api/*`. The frontend therefore makes same-origin requests in Docker; `NEXT_PUBLIC_API_BASE_URL` can point at a separate API origin during local dev.

`next.config.ts` uses `output: "export"` + `trailingSlash: true`. There is no Next.js server at runtime.

### Auth / session boundary (MVP stand-in)

- Frontend gate: `src/lib/auth.ts` hardcodes credentials `user` / `password`; `AuthGate.tsx` stores `pm-authenticated=true` in `localStorage`. Pure client-side demo gate, no real auth.
- Backend boundary: every `/api` request must send header `X-User-Id`; the frontend always sends `user-1` (`MVP_USER_ID` in `src/lib/api.ts`). `current_user_id()` in `main.py` 401s if missing. All board reads/writes are scoped to that user id.
- The seeded MVP user is `user-1` / username `user`, board `board-1` ("Kanban Studio"), five columns, seeded on startup by `initialize_database` -> `seed_mvp_board` in `backend/app/database.py`.

### Board persistence: full-board replace

There is no per-card API. The whole board is read with `GET /api/board` and written with a single transactional `PUT /api/board`. `replace_board()` validates the payload (`validate_board`: unique column ids, every card referenced exactly once), enforces that the column id set is unchanged (rename only, no add/remove/re-id), then deletes all columns/cards for the board and reinserts them with zero-based `position` derived from array order. Each card's `created_at` is carried forward by id; `updated_at` is refreshed. Column and card order is purely positional and always returned sorted by `position`.

SQLite lives at `data/pm.sqlite3` (`DATABASE_PATH` env override), created on demand, foreign keys ON, WAL journal. Connections are opened and closed per request via the `transaction()` context manager in `database.py`. It is runtime data and must never be committed. `docker-compose.yml` persists it in the `app-data` volume.

### Shared board shape (keep in sync manually)

The `BoardData` structure is defined twice and must match:
- Backend: `backend/app/models.py` (`Card`, `Column`, `BoardData` pydantic models).
- Frontend: `frontend/src/lib/kanban.ts` (types + `initialData` + pure ops `moveCard`, `createId`).

Shape: `{ columns: [{ id, title, cardIds: string[] }], cards: { [id]: { id, title, details, priority, dueDate, labels } } }`. `cardIds` is the ordering; `cards` is a lookup map. Note the camelCase `cardIds` and `dueDate` cross the wire as-is (pydantic fields are literally `cardIds` / `dueDate`). `priority` is `"low" | "medium" | "high" | null`; `dueDate` is a `YYYY-MM-DD` string or `null`; `labels` is a `string[]` (trimmed, case-insensitively de-duped, max 10, each max 32 chars — see `normalize_labels` in `models.py` / `normalizeLabels` in `kanban.ts`). All three metadata fields are always present in API responses (`priority`/`dueDate` default `null`, `labels` defaults `[]`); on the frontend `Card` type they are optional.
    
### AI chat

`POST /api/ai/chat` (`main.py` -> `backend/app/ai.py`): sends the full current board JSON, the question, and bounded history (`MAX_HISTORY_MESSAGES=20`, `MAX_MESSAGE_LENGTH=4000`) to OpenRouter via `backend/app/openrouter.py` (stdlib `urllib`, 30s timeout, model from `settings.openrouter_model`, `response_format=json_object`). The frontend trims history to the last 20 messages before sending.

`generate_structured_response()` calls the model and `parse_ai_response()` validates the reply (a leading/trailing ```` ``` ```` fence is stripped first) into `{ assistant_response, board_update: { operations: [...] } | null }`. If `board_update` is present, `main.py` re-reads the board (so the update applies to current state, not the pre-request snapshot), runs `apply_board_update` (`create_card`, `edit_card`, `move_card`, `delete_card`, `rename_column`; any invalid reference raises `ValueError`), and persists via `replace_board` (same validation and single transaction as a manual `PUT`). The response returns `assistant_response`, `board_update`, and the final `board`.

The API key stays server-side only (`backend/app/config.py` reads `OPENROUTER_API_KEY` from env). Missing key -> 503; OpenRouter failure -> 502; invalid AI output / invalid op -> 400.

### Frontend state flow

`AuthGate.tsx` is the top-level orchestrator: it holds the `board` state, loads it after auth, and passes `initialBoard` + `onBoardChange` to `KanbanBoard`. `KanbanBoard` always keeps a local `board` state (re-synced from `initialBoard`); edits apply optimistically and then call `onBoardChange`, which `saveBoard`s and, on failure, rejects so `KanbanBoard` rolls back to the last confirmed board. Column rename is debounced (`RENAME_DEBOUNCE_MS`). Without `onBoardChange` it is the standalone demo (local state only). `ChatSidebar` gets `onBoardUpdate={setBoard}` so an AI mutation refreshes the board in place. dnd-kit drives drag-and-drop (`PointerSensor` + `KeyboardSensor`); `moveCard` in `kanban.ts` is the pure reorder function.

Preserve `data-testid` attributes in board markup (Playwright depends on them). Keep pure board logic in `src/lib/kanban.ts`; keep components using hooks/dnd-kit client-side (`"use client"`).

## Coding standards (from AGENTS.md)

- Simplicity over everything. Do not over-engineer, do not add defensive code or features that were not asked for.
- No emojis anywhere. Keep docs and READMEs minimal.
- Debug by finding the root cause with evidence before changing code; do not guess-and-check.
- Add or update tests in the same change as the behavior they cover.
- Use current library versions and idiomatic patterns (Next 16 / React 19, FastAPI, pydantic v2).
- Color scheme: accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991`, navy `#032147`, gray text `#888888` (also as CSS vars in `frontend/src/app/globals.css`).
