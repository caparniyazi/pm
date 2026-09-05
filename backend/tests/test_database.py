from pathlib import Path

import pytest

from backend.app.database import (
    add_comment,
    authenticate_user,
    create_board,
    create_session,
    create_user,
    delete_board,
    delete_comment,
    delete_session,
    initialize_database,
    list_activity,
    list_boards,
    list_comments,
    read_board,
    rename_board,
    replace_board,
    resolve_session,
)


def test_database_is_created_and_seeded(tmp_path: Path) -> None:
    database_path = str(tmp_path / "nested" / "pm.sqlite3")

    initialize_database(database_path)
    boards = list_boards(database_path, "user-1")

    assert len(boards) == 1
    board = read_board(database_path, "user-1", boards[0]["id"])
    assert board is not None
    assert len(board.columns) == 5
    assert len(board.cards) == 8


def test_board_changes_persist(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board_id = list_boards(database_path, "user-1")[0]["id"]
    board = read_board(database_path, "user-1", board_id)
    assert board is not None

    board.columns[0].title = "Ideas"
    replace_board(database_path, "user-1", board_id, board)

    saved = read_board(database_path, "user-1", board_id)
    assert saved is not None
    assert saved.columns[0].title == "Ideas"


def test_card_priority_and_due_date_round_trip(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board_id = list_boards(database_path, "user-1")[0]["id"]
    board = read_board(database_path, "user-1", board_id)
    assert board is not None

    first_id = board.columns[0].cardIds[0]
    board.cards[first_id].priority = "low"
    board.cards[first_id].dueDate = "2026-03-15"
    second_id = board.columns[0].cardIds[1]
    board.cards[second_id].priority = None
    board.cards[second_id].dueDate = None
    replace_board(database_path, "user-1", board_id, board)

    saved = read_board(database_path, "user-1", board_id)
    assert saved is not None
    assert saved.cards[first_id].priority == "low"
    assert saved.cards[first_id].dueDate == "2026-03-15"
    assert saved.cards[second_id].priority is None
    assert saved.cards[second_id].dueDate is None


def test_seeded_cards_carry_priority(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board_id = list_boards(database_path, "user-1")[0]["id"]
    board = read_board(database_path, "user-1", board_id)
    assert board is not None

    assert board.cards["card-1"].priority == "high"
    assert board.cards["card-6"].priority is None


def test_card_labels_round_trip(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board_id = list_boards(database_path, "user-1")[0]["id"]
    board = read_board(database_path, "user-1", board_id)
    assert board is not None

    first_id = board.columns[0].cardIds[0]
    board.cards[first_id].labels = ["bug", "urgent"]
    second_id = board.columns[0].cardIds[1]
    board.cards[second_id].labels = []
    replace_board(database_path, "user-1", board_id, board)

    saved = read_board(database_path, "user-1", board_id)
    assert saved is not None
    assert saved.cards[first_id].labels == ["bug", "urgent"]
    assert saved.cards[second_id].labels == []


def test_seeded_cards_carry_labels(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board_id = list_boards(database_path, "user-1")[0]["id"]
    board = read_board(database_path, "user-1", board_id)
    assert board is not None

    assert board.cards["card-1"].labels == ["planning", "roadmap"]
    assert board.cards["card-8"].labels == []


def test_invalid_board_update_is_rejected(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board_id = list_boards(database_path, "user-1")[0]["id"]
    board = read_board(database_path, "user-1", board_id)
    assert board is not None
    board.columns[0].cardIds.append(board.columns[1].cardIds[0])

    with pytest.raises(ValueError, match="only one column"):
        replace_board(database_path, "user-1", board_id, board)


def test_replace_board_returns_none_for_unowned_board(tmp_path: Path) -> None:
    database_path = str(tmp_path / "pm.sqlite3")
    initialize_database(database_path)
    board_id = list_boards(database_path, "user-1")[0]["id"]
    board = read_board(database_path, "user-1", board_id)
    assert board is not None

    assert replace_board(database_path, "someone-else", board_id, board) is None


class TestUsers:
    def test_create_user_seeds_a_default_board(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)

        user_id = create_user(database_path, "alice", "password123")

        boards = list_boards(database_path, user_id)
        assert len(boards) == 1
        assert boards[0]["title"] == "My Board"
        board = read_board(database_path, user_id, boards[0]["id"])
        assert board is not None
        assert len(board.columns) == 5
        assert board.cards == {}

    def test_create_user_rejects_duplicate_username(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        create_user(database_path, "alice", "password123")

        with pytest.raises(ValueError):
            create_user(database_path, "alice", "another-password")

    def test_authenticate_user(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        create_user(database_path, "alice", "password123")

        assert authenticate_user(database_path, "alice", "password123") is not None
        assert authenticate_user(database_path, "alice", "wrong") is None
        assert authenticate_user(database_path, "ghost", "password123") is None


class TestSessions:
    def test_session_round_trip(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        user_id = create_user(database_path, "alice", "password123")

        token = create_session(database_path, user_id)

        assert resolve_session(database_path, token) == user_id

    def test_deleted_session_no_longer_resolves(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        user_id = create_user(database_path, "alice", "password123")
        token = create_session(database_path, user_id)

        delete_session(database_path, token)

        assert resolve_session(database_path, token) is None

    def test_unknown_token_does_not_resolve(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)

        assert resolve_session(database_path, "not-a-real-token") is None


class TestMultipleBoards:
    def test_create_board_adds_a_second_board(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        user_id = create_user(database_path, "alice", "password123")

        create_board(database_path, user_id, "Second Board")

        boards = list_boards(database_path, user_id)
        assert {board["title"] for board in boards} == {"My Board", "Second Board"}

    def test_rename_board(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        user_id = create_user(database_path, "alice", "password123")
        board_id = list_boards(database_path, user_id)[0]["id"]

        result = rename_board(database_path, user_id, board_id, "Renamed")

        assert result is not None
        assert result["title"] == "Renamed"

    def test_rename_board_rejects_other_users_board(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        user_id = create_user(database_path, "alice", "password123")
        other_id = create_user(database_path, "bob", "password123")
        board_id = list_boards(database_path, user_id)[0]["id"]

        assert rename_board(database_path, other_id, board_id, "Renamed") is None

    def test_delete_board_removes_it(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        user_id = create_user(database_path, "alice", "password123")
        second = create_board(database_path, user_id, "Second Board")

        assert delete_board(database_path, user_id, second["id"]) is True
        assert len(list_boards(database_path, user_id)) == 1

    def test_cannot_delete_the_only_board(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        user_id = create_user(database_path, "alice", "password123")
        board_id = list_boards(database_path, user_id)[0]["id"]

        with pytest.raises(ValueError, match="only board"):
            delete_board(database_path, user_id, board_id)

    def test_delete_board_rejects_other_users_board(self, tmp_path: Path) -> None:
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        user_id = create_user(database_path, "alice", "password123")
        other_id = create_user(database_path, "bob", "password123")
        board_id = list_boards(database_path, user_id)[0]["id"]

        assert delete_board(database_path, other_id, board_id) is False


class TestCommentsAndActivity:
    def _setup(self, tmp_path: Path):
        database_path = str(tmp_path / "pm.sqlite3")
        initialize_database(database_path)
        board_id = list_boards(database_path, "user-1")[0]["id"]
        board = read_board(database_path, "user-1", board_id)
        card_id = board.columns[0].cardIds[0]
        return database_path, board_id, card_id, board

    def test_add_and_list_comments(self, tmp_path: Path) -> None:
        database_path, board_id, card_id, _ = self._setup(tmp_path)

        created = add_comment(database_path, "user-1", board_id, card_id, "First note")
        assert created is not None
        assert created["author"] == "user"
        assert created["cardId"] == card_id

        comments = list_comments(database_path, "user-1", board_id)
        assert [comment["body"] for comment in comments] == ["First note"]

    def test_add_comment_records_activity(self, tmp_path: Path) -> None:
        database_path, board_id, card_id, _ = self._setup(tmp_path)

        add_comment(database_path, "user-1", board_id, card_id, "Looks good")

        activity = list_activity(database_path, "user-1", board_id)
        assert activity[0]["kind"] == "comment_added"
        assert activity[0]["cardId"] == card_id

    def test_add_comment_rejects_unknown_card(self, tmp_path: Path) -> None:
        database_path, board_id, _, _ = self._setup(tmp_path)

        with pytest.raises(ValueError, match="Card not found"):
            add_comment(database_path, "user-1", board_id, "ghost-card", "hi")

    def test_comments_are_scoped_to_the_owner(self, tmp_path: Path) -> None:
        database_path, board_id, card_id, _ = self._setup(tmp_path)
        other_id = create_user(database_path, "mallory", "password123")

        assert add_comment(database_path, other_id, board_id, card_id, "peek") is None
        assert list_comments(database_path, other_id, board_id) is None

    def test_only_the_author_can_delete_a_comment(self, tmp_path: Path) -> None:
        database_path, board_id, card_id, _ = self._setup(tmp_path)
        created = add_comment(database_path, "user-1", board_id, card_id, "mine")
        other_id = create_user(database_path, "mallory", "password123")

        assert delete_comment(database_path, other_id, board_id, created["id"]) is False
        assert delete_comment(database_path, "user-1", board_id, created["id"]) is True
        assert list_comments(database_path, "user-1", board_id) == []

    def test_replace_board_records_a_diff_and_prunes_deleted_card_comments(
        self, tmp_path: Path
    ) -> None:
        database_path, board_id, card_id, board = self._setup(tmp_path)
        add_comment(database_path, "user-1", board_id, card_id, "keep me?")

        board.columns[0].title = "Ideas"
        board.cards[card_id].priority = "low"
        removed = board.columns[0].cardIds.pop()
        del board.cards[removed]
        replace_board(database_path, "user-1", board_id, board)

        kinds = {entry["kind"] for entry in list_activity(database_path, "user-1", board_id)}
        assert {"column_renamed", "card_edited", "card_deleted"} <= kinds

        # The commented card is still on the board, so its comment survives.
        assert len(list_comments(database_path, "user-1", board_id)) == 1

        # Now delete the commented card too; its comment is pruned.
        board = read_board(database_path, "user-1", board_id)
        board.columns[0].cardIds.remove(card_id)
        del board.cards[card_id]
        replace_board(database_path, "user-1", board_id, board)
        assert list_comments(database_path, "user-1", board_id) == []


def test_outdated_schema_is_reset_automatically(tmp_path: Path) -> None:
    import sqlite3

    database_path = str(tmp_path / "pm.sqlite3")
    Path(database_path).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.execute(
        "CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)"
    )
    connection.execute(
        "INSERT INTO users (id, username, created_at) VALUES ('user-1', 'user', 'x')"
    )
    connection.commit()
    connection.close()

    initialize_database(database_path)

    boards = list_boards(database_path, "user-1")
    assert len(boards) == 1
