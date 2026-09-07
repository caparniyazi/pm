from backend.app.activity import diff_board_activity
from backend.app.models import BoardData


def board(cards_by_column: dict[str, list[dict]], titles: dict[str, str] | None = None) -> BoardData:
    titles = titles or {}
    columns = []
    cards: dict[str, dict] = {}
    for column_id, card_list in cards_by_column.items():
        columns.append(
            {
                "id": column_id,
                "title": titles.get(column_id, column_id.title()),
                "cardIds": [card["id"] for card in card_list],
            }
        )
        for card in card_list:
            cards[card["id"]] = {"details": "", **card}
    return BoardData(columns=columns, cards=cards)


def test_no_changes_produces_no_entries() -> None:
    before = board({"todo": [{"id": "c1", "title": "A"}], "done": []})
    assert diff_board_activity(before, before) == []


def test_detects_created_and_deleted_cards() -> None:
    before = board({"todo": [{"id": "c1", "title": "A"}], "done": []})
    after = board({"todo": [{"id": "c2", "title": "B"}], "done": []})

    kinds = [(entry.kind, entry.card_id) for entry in diff_board_activity(before, after)]
    assert ("card_created", "c2") in kinds
    assert ("card_deleted", "c1") in kinds


def test_detects_move_and_edit_together() -> None:
    before = board(
        {"todo": [{"id": "c1", "title": "A", "priority": "low"}], "done": []}
    )
    after = board(
        {"todo": [], "done": [{"id": "c1", "title": "A", "priority": "high"}]}
    )

    entries = diff_board_activity(before, after)
    kinds = [entry.kind for entry in entries]
    assert kinds == ["card_moved", "card_edited"]
    assert "from Todo to Done" in entries[0].summary
    assert 'Updated priority on "A"' == entries[1].summary


def test_title_change_reads_as_a_rename() -> None:
    before = board({"todo": [{"id": "c1", "title": "Old"}]})
    after = board({"todo": [{"id": "c1", "title": "New"}]})

    [entry] = diff_board_activity(before, after)
    assert entry.kind == "card_edited"
    assert entry.summary == 'Renamed "Old" to "New"'


def test_detects_column_rename() -> None:
    before = board({"todo": [{"id": "c1", "title": "A"}]}, titles={"todo": "To do"})
    after = board({"todo": [{"id": "c1", "title": "A"}]}, titles={"todo": "Backlog"})

    [entry] = diff_board_activity(before, after)
    assert entry.kind == "column_renamed"
    assert entry.summary == 'Renamed column "To do" to "Backlog"'
    assert entry.card_id is None


def test_detects_column_add_and_remove() -> None:
    before = board({"todo": [], "done": []}, titles={"todo": "To do", "done": "Done"})
    after = board({"todo": [], "blocked": []}, titles={"todo": "To do", "blocked": "Blocked"})

    entries = {(entry.kind, entry.summary) for entry in diff_board_activity(before, after)}
    assert ("column_added", 'Added column "Blocked"') in entries
    assert ("column_removed", 'Removed column "Done"') in entries
