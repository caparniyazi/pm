import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

from backend.app.models import BoardData
from backend.app.security import generate_id, generate_token, hash_password, verify_password


SESSION_TTL_DAYS = 30

DEFAULT_COLUMN_TITLES = ["Backlog", "Discovery", "In Progress", "Review", "Done"]

# (id, title, details, column_index, priority, due_date)
INITIAL_CARDS = [
    ("card-1", "Align roadmap themes", "Draft quarterly themes with impact statements and metrics.", 0, "high", None),
    ("card-2", "Gather customer signals", "Review support tags, sales notes, and churn feedback.", 0, "medium", None),
    ("card-3", "Prototype analytics view", "Sketch initial dashboard layout and key drill-downs.", 1, "medium", None),
    ("card-4", "Refine status language", "Standardize column labels and tone across the board.", 2, "low", None),
    ("card-5", "Design card layout", "Add hierarchy and spacing for scanning dense lists.", 2, "high", None),
    ("card-6", "QA micro-interactions", "Verify hover, focus, and loading states.", 3, None, None),
    ("card-7", "Ship marketing page", "Final copy approved and asset pack delivered.", 4, None, None),
    ("card-8", "Close onboarding sprint", "Document release notes and share internally.", 4, None, None),
]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect(database_path: str) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


@contextmanager
def transaction(database_path: str) -> Iterator[sqlite3.Connection]:
    connection = connect(database_path)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def _has_column(connection: sqlite3.Connection, table: str, column: str) -> bool:
    rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row["name"] == column for row in rows)


def _reset_outdated_schema(connection: sqlite3.Connection) -> None:
    """Drop tables from the pre-auth, single-board schema.

    This is a local MVP with no migration tooling; a database created before
    user accounts existed is missing users.password_hash. Rebuilding it from
    scratch is safe because it only ever holds local demo data.
    """
    users_exists = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).fetchone()
    if users_exists and not _has_column(connection, "users", "password_hash"):
        for table in ("cards", "columns", "boards", "sessions", "users"):
            connection.execute(f"DROP TABLE IF EXISTS {table}")


def _add_missing_card_columns(connection: sqlite3.Connection) -> None:
    """Add card metadata columns to a database created before they existed.

    New columns are nullable with no default, so a plain ADD COLUMN is safe
    and there is no data to backfill. This is the only forward migration the
    local MVP needs; a schema too old for this is rebuilt by
    ``_reset_outdated_schema``.
    """
    for column, definition in (("priority", "TEXT"), ("due_date", "TEXT")):
        if not _has_column(connection, "cards", column):
            connection.execute(f"ALTER TABLE cards ADD COLUMN {column} {definition}")


def initialize_database(database_path: str) -> None:
    Path(database_path).parent.mkdir(parents=True, exist_ok=True)
    with transaction(database_path) as connection:
        _reset_outdated_schema(connection)
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS boards (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS columns (
                id TEXT PRIMARY KEY,
                board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                position INTEGER NOT NULL,
                UNIQUE(board_id, position)
            );
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
                priority TEXT,
                due_date TEXT,
                position INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(column_id, position)
            );
            """
        )
        _add_missing_card_columns(connection)
        seed_mvp_board(connection)


def _insert_default_columns(connection: sqlite3.Connection, board_id: str) -> None:
    for position, title in enumerate(DEFAULT_COLUMN_TITLES):
        connection.execute(
            "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
            (generate_id("col"), board_id, title, position),
        )


def seed_mvp_board(connection: sqlite3.Connection) -> None:
    user = connection.execute(
        "SELECT id FROM users WHERE username = ?", ("user",)
    ).fetchone()
    timestamp = now()
    if user is None:
        connection.execute(
            "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            ("user-1", "user", hash_password("password"), timestamp),
        )
        user_id = "user-1"
    else:
        user_id = user["id"]

    board = connection.execute(
        "SELECT id FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    if board is not None:
        return

    board_id = "board-1"
    connection.execute(
        "INSERT INTO boards (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (board_id, user_id, "Kanban Studio", timestamp, timestamp),
    )
    column_ids = ["col-backlog", "col-discovery", "col-progress", "col-review", "col-done"]
    for position, (column_id, title) in enumerate(zip(column_ids, DEFAULT_COLUMN_TITLES)):
        connection.execute(
            "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
            (column_id, board_id, title, position),
        )
    column_positions = {column_id: 0 for column_id in column_ids}
    for card_id, title, details, column_index, priority, due_date in INITIAL_CARDS:
        column_id = column_ids[column_index]
        position = column_positions[column_id]
        connection.execute(
            """
            INSERT INTO cards
              (id, column_id, title, details, priority, due_date, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (card_id, column_id, title, details, priority, due_date, position, timestamp, timestamp),
        )
        column_positions[column_id] += 1


def create_user(database_path: str, username: str, password: str) -> str:
    with transaction(database_path) as connection:
        existing = connection.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if existing is not None:
            raise ValueError("Username is already taken")

        timestamp = now()
        user_id = generate_id("user")
        connection.execute(
            "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user_id, username, hash_password(password), timestamp),
        )

        board_id = generate_id("board")
        connection.execute(
            "INSERT INTO boards (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (board_id, user_id, "My Board", timestamp, timestamp),
        )
        _insert_default_columns(connection, board_id)
    return user_id


def authenticate_user(database_path: str, username: str, password: str) -> str | None:
    with transaction(database_path) as connection:
        row = connection.execute(
            "SELECT id, password_hash FROM users WHERE username = ?", (username,)
        ).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        return None
    return row["id"]


def get_username(database_path: str, user_id: str) -> str | None:
    with transaction(database_path) as connection:
        row = connection.execute(
            "SELECT username FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    return row["username"] if row is not None else None


def create_session(database_path: str, user_id: str) -> str:
    token = generate_token()
    timestamp = now()
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    ).isoformat()
    with transaction(database_path) as connection:
        connection.execute(
            "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, timestamp, expires_at),
        )
    return token


def resolve_session(database_path: str, token: str) -> str | None:
    with transaction(database_path) as connection:
        row = connection.execute(
            "SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,)
        ).fetchone()
        if row is None:
            return None
        if row["expires_at"] < now():
            connection.execute("DELETE FROM sessions WHERE token = ?", (token,))
            return None
        return row["user_id"]


def delete_session(database_path: str, token: str) -> None:
    with transaction(database_path) as connection:
        connection.execute("DELETE FROM sessions WHERE token = ?", (token,))


def list_boards(database_path: str, user_id: str) -> list[dict]:
    with transaction(database_path) as connection:
        rows = connection.execute(
            "SELECT id, title, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
    return [
        {"id": row["id"], "title": row["title"], "updatedAt": row["updated_at"]}
        for row in rows
    ]


def create_board(database_path: str, user_id: str, title: str) -> dict:
    timestamp = now()
    board_id = generate_id("board")
    with transaction(database_path) as connection:
        connection.execute(
            "INSERT INTO boards (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (board_id, user_id, title, timestamp, timestamp),
        )
        _insert_default_columns(connection, board_id)
    return {"id": board_id, "title": title, "updatedAt": timestamp}


def rename_board(database_path: str, user_id: str, board_id: str, title: str) -> dict | None:
    timestamp = now()
    with transaction(database_path) as connection:
        board = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
        if board is None:
            return None
        connection.execute(
            "UPDATE boards SET title = ?, updated_at = ? WHERE id = ?",
            (title, timestamp, board_id),
        )
    return {"id": board_id, "title": title, "updatedAt": timestamp}


def delete_board(database_path: str, user_id: str, board_id: str) -> bool:
    with transaction(database_path) as connection:
        board = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
        if board is None:
            return False
        board_count = connection.execute(
            "SELECT COUNT(*) AS count FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()["count"]
        if board_count <= 1:
            raise ValueError("Cannot delete your only board")
        connection.execute("DELETE FROM boards WHERE id = ?", (board_id,))
    return True


def read_board(database_path: str, user_id: str, board_id: str) -> BoardData | None:
    with transaction(database_path) as connection:
        board = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
        if board is None:
            return None
        columns = connection.execute(
            "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
            (board["id"],),
        ).fetchall()
        cards = connection.execute(
            """
            SELECT cards.id, cards.title, cards.details, cards.priority,
                   cards.due_date, cards.column_id
            FROM cards
            JOIN columns ON columns.id = cards.column_id
            WHERE columns.board_id = ?
            ORDER BY cards.column_id, cards.position
            """,
            (board["id"],),
        ).fetchall()

    cards_by_id = {
        card["id"]: {
            "id": card["id"],
            "title": card["title"],
            "details": card["details"],
            "priority": card["priority"],
            "dueDate": card["due_date"],
        }
        for card in cards
    }
    card_ids_by_column = {column["id"]: [] for column in columns}
    for card in cards:
        card_ids_by_column[card["column_id"]].append(card["id"])
    return BoardData(
        columns=[
            {
                "id": column["id"],
                "title": column["title"],
                "cardIds": card_ids_by_column[column["id"]],
            }
            for column in columns
        ],
        cards=cards_by_id,
    )


def replace_board(
    database_path: str, user_id: str, board_id: str, board_data: BoardData
) -> BoardData | None:
    with transaction(database_path) as connection:
        board = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
        if board is None:
            return None

        existing_column_ids = {
            row["id"]
            for row in connection.execute(
                "SELECT id FROM columns WHERE board_id = ?", (board_id,)
            )
        }
        validate_board(board_data)
        if existing_column_ids and {c.id for c in board_data.columns} != existing_column_ids:
            raise ValueError("Board columns can be renamed but not added or removed")

        created_at_by_card = {
            row["id"]: row["created_at"]
            for row in connection.execute(
                """
                SELECT cards.id, cards.created_at
                FROM cards
                JOIN columns ON columns.id = cards.column_id
                WHERE columns.board_id = ?
                """,
                (board_id,),
            )
        }
        timestamp = now()
        connection.execute("DELETE FROM cards WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?)", (board_id,))
        connection.execute("DELETE FROM columns WHERE board_id = ?", (board_id,))
        for column_position, column in enumerate(board_data.columns):
            connection.execute(
                "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
                (column.id, board_id, column.title, column_position),
            )
            for card_position, card_id in enumerate(column.cardIds):
                card = board_data.cards[card_id]
                created_at = created_at_by_card.get(card.id, timestamp)
                connection.execute(
                    """
                    INSERT INTO cards
                      (id, column_id, title, details, priority, due_date, position, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        card.id,
                        column.id,
                        card.title,
                        card.details,
                        card.priority,
                        card.dueDate,
                        card_position,
                        created_at,
                        timestamp,
                    ),
                )
        connection.execute(
            "UPDATE boards SET updated_at = ? WHERE id = ?", (timestamp, board_id)
        )
    return board_data


def validate_board(board_data: BoardData) -> None:
    column_ids = [column.id for column in board_data.columns]
    if len(column_ids) != len(set(column_ids)):
        raise ValueError("Column IDs must be unique")
    referenced_card_ids = [
        card_id for column in board_data.columns for card_id in column.cardIds
    ]
    if len(referenced_card_ids) != len(set(referenced_card_ids)):
        raise ValueError("Cards can appear in only one column")
    if set(referenced_card_ids) != set(board_data.cards):
        raise ValueError("Every card must appear in exactly one column")
