# Database approach

The backend will use SQLite at `data/pm.sqlite3`. The application creates the
directory and database when they do not exist, enables foreign keys, and uses
WAL journaling for reliable local reads and writes. The database file is
runtime data and must not be committed.

The schema is defined in [`database-schema.json`](database-schema.json). It
separates users, boards, columns, and cards so the MVP can support multiple
users later while enforcing one board per user now. Column and card order is
stored as a zero-based `position` and is returned in that order.

At initialization, the backend creates the tables and seeds the hardcoded MVP
user's board with the existing five-column demo data if that board is absent.
Authentication remains outside this schema for the MVP; no plaintext password
is stored. Board mutations use a single transaction so a failed update cannot
leave ordering or ownership partially changed.

The column set is fixed once a board is seeded: `PUT /api/board` may rename
columns and reorder or edit cards, but a payload that adds, removes, or changes
a column id is rejected. A full-board replace preserves each card's `created_at`
(matched by card id) and refreshes `updated_at`.

The JSON schema and this document must be approved before database persistence
is implemented in Part 6.
