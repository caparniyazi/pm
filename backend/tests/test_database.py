from pathlib import Path

import pytest

from backend.app.database import initialize_database, read_board, replace_board
from backend.app.models import BoardData


def test_database_is_created_and_seeded(tmp_path: Path) -> None:
    database_path = str(tmp_path / "nested" / "pm.sqlite3")

    initialize_database(database_path)
    board = read_board(database_path, "user-1")

    assert board is not None
    assert len(board.columns) == 5
    assert len(board.cards) == 8


def test_board_changes_persist(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board = read_board(database_path, "user-1")
    assert board is not None

    board.columns[0].title = "Ideas"
    replace_board(database_path, "user-1", board)

    saved = read_board(database_path, "user-1")
    assert saved is not None
    assert saved.columns[0].title == "Ideas"


def test_invalid_board_update_is_rejected(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board = read_board(database_path, "user-1")
    assert board is not None
    board.columns[0].cardIds.append(board.columns[1].cardIds[0])

    with pytest.raises(ValueError, match="only one column"):
        replace_board(database_path, "user-1", board)
