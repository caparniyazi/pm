# Database approach

The backend uses SQLite at `data/pm.sqlite3`. The application creates the
directory and database when they do not exist, enables foreign keys, and uses
WAL journaling for reliable local reads and writes. The database file is
runtime data and must not be committed.

The schema is defined in [`database-schema.json`](database-schema.json): users
own any number of boards, each board owns a fixed set of columns, and each
column owns an ordered set of cards. Column and card order is stored as a
zero-based `position` and is returned in that order.

## Accounts and sessions

Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes (`backend/app/security.py`),
never in plaintext. `POST /api/auth/register` and `POST /api/auth/login` issue
an opaque bearer token recorded in `sessions` (30-day expiry); every other
`/api/*` route (other than the two auth routes and `/api/hello`) requires
`Authorization: Bearer <token>` and resolves it to a `user_id` server-side.
`POST /api/auth/logout` deletes the session row. There is no password reset
flow for this local MVP.

At initialization, the backend seeds a demo account (`user` / `password`) with
the original five-column, eight-card board (id `board-1`, title
"Kanban Studio") if that account does not already exist. A database created
before accounts existed (missing `users.password_hash`) is detected and
rebuilt automatically, since it only ever holds local demo data and there is
no migration tooling.

## Boards

Registering a new user also creates one starter board ("My Board") with the
same five fixed column titles (Backlog, Discovery, In Progress, Review, Done)
and no cards. Users can create, rename, and delete additional boards through
`/api/boards`; a user's last remaining board cannot be deleted. All board,
column, and card operations are scoped to `(user_id, board_id)` ownership
checks, so one user can never read or mutate another user's data.

A board's column set is fixed once created: `PUT /api/boards/{board_id}` may
rename columns and reorder or edit cards, but a payload that adds, removes, or
changes a column id is rejected. A full-board replace preserves each card's
`created_at` (matched by card id) and refreshes `updated_at`. The board
content payload shape (`{ columns, cards }`) keeps its top-level structure from
the original single-board MVP; only the routing (`/api/boards/{board_id}`
instead of `/api/board`) and the authentication boundary changed.

Each card carries structured metadata alongside `title` and `details`:
`priority` (`"low"`, `"medium"`, `"high"`, or `null`), `dueDate` (a
`YYYY-MM-DD` calendar date, or `null`), and `labels` (an array of short tag
strings). `labels` is stored on the `cards` table as a JSON text column
(`labels`, default `'[]'`) and is trimmed, de-duplicated case-insensitively,
and bounded (at most 10 labels, each at most 32 characters) by
`normalize_labels` in `models.py`, shared by the `Card` model and the AI card
operations. `priority` / `due_date` are plain nullable columns. All three
fields are always present in API responses (`priority`/`dueDate` default to
`null`, `labels` to `[]`). A database created before any of these columns
existed has them added by a plain `ALTER TABLE` at startup (no backfill
needed).

## Comments and activity

Card comments and the board activity feed are the first data that is *not*
carried in the full-board payload. They live in their own tables (`comments`,
`activity`) and are read and written through dedicated sub-resource routes:
`GET /api/boards/{id}/comments`,
`POST /api/boards/{id}/cards/{cardId}/comments`,
`DELETE /api/boards/{id}/comments/{commentId}`, and
`GET /api/boards/{id}/activity`. Both new tables are created by
`CREATE TABLE IF NOT EXISTS`, so an existing local database picks them up on
the next startup with no migration.

`comments.card_id` is a plain column, not a foreign key: a full-board `PUT`
deletes and reinserts every card row, so a cascade would wipe every thread on
each save. Comments are scoped by `(board_id, card_id)` instead, and only the
card ids that a `PUT` actually removes have their comments deleted. A comment
stores an `author` username snapshot and can only be deleted by its author.

The `activity` feed is append-only. Card-change entries (`card_created`,
`card_edited`, `card_moved`, `card_deleted`, `column_renamed`) are derived by
`diff_board_activity` in `activity.py`, which compares the board snapshot
before and after each `PUT`. Comment entries (`comment_added`,
`comment_deleted`) are written directly by the comment routes.
`GET /api/boards/{id}/activity` returns the most recent 100 entries, newest
first.
