import json

import pytest

from backend.app.ai import (
    AddColumnOperation,
    AIChatRequest,
    BoardUpdate,
    CreateCardOperation,
    DeleteCardOperation,
    EditCardOperation,
    MoveCardOperation,
    MoveColumnOperation,
    RemoveColumnOperation,
    RenameColumnOperation,
    apply_board_update,
    build_messages,
    parse_ai_response,
)
from backend.app.models import BoardData


def board() -> BoardData:
    return BoardData(
        columns=[
            {"id": "todo", "title": "To do", "cardIds": ["card-1"]},
            {"id": "done", "title": "Done", "cardIds": []},
        ],
        cards={"card-1": {"id": "card-1", "title": "First", "details": ""}},
    )


def test_build_messages_includes_board_question_and_history() -> None:
    messages = build_messages(
        board(),
        AIChatRequest(
            question="Move the first card",
            history=[{"role": "user", "content": "Please help"}],
        ),
    )

    context = json.loads(messages[1]["content"])
    assert context["current_board"]["columns"][0]["id"] == "todo"
    assert context["question"] == "Move the first card"
    assert context["conversation_history"][0]["content"] == "Please help"


def test_parse_ai_response_accepts_response_only_and_updates() -> None:
    response = parse_ai_response(
        '{"assistant_response":"Done","board_update":null}'
    )
    assert response.board_update is None

    response = parse_ai_response(
        '{"assistant_response":"Done","board_update":{"operations":['
        '{"kind":"rename_column","column_id":"todo","title":"Next"}]}}'
    )
    assert response.board_update is not None


def test_parse_ai_response_rejects_malformed_and_partial_responses() -> None:
    with pytest.raises(ValueError):
        parse_ai_response("not json")
    with pytest.raises(ValueError):
        parse_ai_response('{"board_update":null}')
    with pytest.raises(ValueError):
        parse_ai_response(
            '{"assistant_response":"Bad","board_update":{"operations":['
            '{"kind":"unknown"}]}}'
        )


def test_apply_board_update_supports_all_operations() -> None:
    updated = apply_board_update(
        board(),
        BoardUpdate(
            operations=[
                CreateCardOperation(
                    kind="create_card",
                    card_id="card-2",
                    title="Second",
                    column_id="todo",
                ),
                EditCardOperation(
                    kind="edit_card", card_id="card-1", details="Updated"
                ),
                MoveCardOperation(
                    kind="move_card", card_id="card-2", column_id="done"
                ),
                RenameColumnOperation(
                    kind="rename_column", column_id="done", title="Complete"
                ),
                DeleteCardOperation(kind="delete_card", card_id="card-1"),
            ]
        ),
    )

    assert list(updated.cards) == ["card-2"]
    assert updated.columns[0].cardIds == []
    assert updated.columns[1].title == "Complete"
    assert updated.columns[1].cardIds == ["card-2"]


def test_create_and_edit_card_carry_priority_and_due_date() -> None:
    updated = apply_board_update(
        board(),
        BoardUpdate(
            operations=[
                CreateCardOperation(
                    kind="create_card",
                    card_id="card-2",
                    title="Second",
                    column_id="todo",
                    priority="high",
                    due_date="2026-02-01",
                ),
                EditCardOperation(
                    kind="edit_card",
                    card_id="card-1",
                    priority="low",
                    due_date="2026-03-10",
                ),
            ]
        ),
    )

    assert updated.cards["card-2"].priority == "high"
    assert updated.cards["card-2"].dueDate == "2026-02-01"
    assert updated.cards["card-1"].priority == "low"
    assert updated.cards["card-1"].dueDate == "2026-03-10"


def test_edit_card_with_only_priority_is_allowed() -> None:
    updated = apply_board_update(
        board(),
        BoardUpdate(
            operations=[
                EditCardOperation(kind="edit_card", card_id="card-1", priority="medium")
            ]
        ),
    )

    assert updated.cards["card-1"].priority == "medium"
    assert updated.cards["card-1"].title == "First"


def test_create_and_edit_card_carry_labels() -> None:
    updated = apply_board_update(
        board(),
        BoardUpdate(
            operations=[
                CreateCardOperation(
                    kind="create_card",
                    card_id="card-2",
                    title="Second",
                    column_id="todo",
                    labels=["Bug", "  bug ", "urgent"],
                ),
                EditCardOperation(
                    kind="edit_card", card_id="card-1", labels=["research"]
                ),
            ]
        ),
    )

    assert updated.cards["card-2"].labels == ["Bug", "urgent"]
    assert updated.cards["card-1"].labels == ["research"]


def test_edit_card_clears_labels_with_empty_list() -> None:
    start = board()
    start.cards["card-1"].labels = ["stale"]

    updated = apply_board_update(
        start,
        BoardUpdate(
            operations=[
                EditCardOperation(kind="edit_card", card_id="card-1", labels=[])
            ]
        ),
    )

    assert updated.cards["card-1"].labels == []


def test_edit_card_without_labels_key_leaves_them_untouched() -> None:
    start = board()
    start.cards["card-1"].labels = ["keep"]

    updated = apply_board_update(
        start,
        BoardUpdate(
            operations=[
                EditCardOperation(kind="edit_card", card_id="card-1", details="new")
            ]
        ),
    )

    assert updated.cards["card-1"].labels == ["keep"]


def test_operations_reject_invalid_priority_and_due_date() -> None:
    with pytest.raises(ValueError):
        CreateCardOperation(
            kind="create_card",
            card_id="x",
            title="X",
            column_id="todo",
            priority="urgent",
        )
    with pytest.raises(ValueError):
        EditCardOperation(kind="edit_card", card_id="card-1", due_date="03/10/2026")


def test_add_remove_and_move_column_operations() -> None:
    updated = apply_board_update(
        board(),
        BoardUpdate(
            operations=[
                AddColumnOperation(
                    kind="add_column", column_id="blocked", title="Blocked", position=1
                ),
                MoveColumnOperation(
                    kind="move_column", column_id="blocked", position=0
                ),
                RemoveColumnOperation(kind="remove_column", column_id="done"),
            ]
        ),
    )

    assert [column.id for column in updated.columns] == ["blocked", "todo"]


def test_remove_column_rejects_a_column_with_cards() -> None:
    with pytest.raises(ValueError, match="still has cards"):
        apply_board_update(
            board(),
            BoardUpdate(
                operations=[
                    RemoveColumnOperation(kind="remove_column", column_id="todo")
                ]
            ),
        )


def test_add_column_rejects_a_duplicate_id() -> None:
    with pytest.raises(ValueError, match="already exists"):
        apply_board_update(
            board(),
            BoardUpdate(
                operations=[
                    AddColumnOperation(
                        kind="add_column", column_id="todo", title="Dup"
                    )
                ]
            ),
        )


def test_invalid_multi_operation_does_not_mutate_original_board() -> None:
    original = board()
    update = BoardUpdate(
        operations=[
            RenameColumnOperation(kind="rename_column", column_id="todo", title="Next"),
            DeleteCardOperation(kind="delete_card", card_id="missing"),
        ]
    )

    with pytest.raises(ValueError, match="Card not found"):
        apply_board_update(original, update)

    assert original.columns[0].title == "To do"
    assert original.columns[0].cardIds == ["card-1"]
