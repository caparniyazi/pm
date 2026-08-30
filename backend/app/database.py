import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from backend.app.models import BoardData


INITIAL_COLUMNS = [
    ("col-backlog", "Backlog"),
    ("col-discovery", "Discovery"),
    ("col-progress", "In Progress"),
    ("col-review", "Review"),
    ("col-done", "Done"),
]

INITIAL_CARDS = [
    ("card-1", "Align roadmap themes", "Draft quarterly themes with impact statements and metrics.", 0),
    ("card-2", "Gather customer signals", "Review support tags, sales notes, and churn feedback.", 0),
    ("card-3", "Prototype analytics view", "Sketch initial dashboard layout and key drill-downs.", 1),
    ("card-4", "Refine status language", "Standardize column labels and tone across the board.", 2),
    ("card-5", "Design card layout", "Add hierarchy and spacing for scanning dense lists.", 2),
    ("card-6", "QA micro-interactions", "Verify hover, focus, and loading states.", 3),
    ("card-7", "Ship marketing page", "Final copy approved and asset pack delivered.", 4),
    ("card-8", "Close onboarding sprint", "Document release notes and share internally.", 4),
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


def initialize_database(database_path: str) -> None:
    Path(database_path).parent.mkdir(parents=True, exist_ok=True)
    with transaction(database_path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS boards (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
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
                position INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(column_id, position)
            );
            """
        )
        seed_mvp_board(connection)


def seed_mvp_board(connection: sqlite3.Connection) -> None:
    user = connection.execute(
        "SELECT id FROM users WHERE username = ?", ("user",)
    ).fetchone()
    timestamp = now()
    if user is None:
        connection.execute(
            "INSERT INTO users (id, username, created_at) VALUES (?, ?, ?)",
            ("user-1", "user", timestamp),
        )
        user_id = "user-1"
    else:
        user_id = user["id"]

    board = connection.execute(
        "SELECT id FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    if board is not None:
        return

    connection.execute(
        "INSERT INTO boards (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        ("board-1", user_id, "Kanban Studio", timestamp, timestamp),
    )
    for position, (column_id, title) in enumerate(INITIAL_COLUMNS):
        connection.execute(
            "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
            (column_id, "board-1", title, position),
        )
    column_positions = {column_id: 0 for column_id, _ in INITIAL_COLUMNS}
    for card_id, title, details, column_position in INITIAL_CARDS:
        column_id = INITIAL_COLUMNS[column_position][0]
        position = column_positions[column_id]
        connection.execute(
            """
            INSERT INTO cards
              (id, column_id, title, details, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (card_id, column_id, title, details, position, timestamp, timestamp),
        )
        column_positions[column_id] += 1


def read_board(database_path: str, user_id: str) -> BoardData | None:
    with transaction(database_path) as connection:
        board = connection.execute(
            "SELECT id FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if board is None:
            return None
        columns = connection.execute(
            "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
            (board["id"],),
        ).fetchall()
        cards = connection.execute(
            """
            SELECT cards.id, cards.title, cards.details, cards.column_id
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


def replace_board(database_path: str, user_id: str, board_data: BoardData) -> BoardData:
    with transaction(database_path) as connection:
        board = connection.execute(
            "SELECT id FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if board is None:
            raise ValueError("Board not found")

        board_id = board["id"]
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
                      (id, column_id, title, details, position, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (card.id, column.id, card.title, card.details, card_position, created_at, timestamp),
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
