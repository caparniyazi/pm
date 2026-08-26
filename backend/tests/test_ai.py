import json

import pytest

from backend.app.ai import (
    AIChatRequest,
    BoardUpdate,
    CreateCardOperation,
    DeleteCardOperation,
    EditCardOperation,
    MoveCardOperation,
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
