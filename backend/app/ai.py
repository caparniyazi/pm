import json
from typing import Annotated, Literal

from pydantic import BaseModel, Field, ValidationError

from backend.app.models import BoardData, Card, DUE_DATE_PATTERN, Priority
from backend.app.openrouter import ask_openrouter_messages


MAX_HISTORY_MESSAGES = 20
MAX_MESSAGE_LENGTH = 4000


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)


class AIChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)
    history: list[ConversationMessage] = Field(
        default_factory=list, max_length=MAX_HISTORY_MESSAGES
    )


class CreateCardOperation(BaseModel):
    kind: Literal["create_card"]
    card_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    details: str = ""
    priority: Priority | None = None
    due_date: str | None = Field(default=None, pattern=DUE_DATE_PATTERN)
    column_id: str = Field(min_length=1)
    position: int = Field(default=-1, ge=-1)


class EditCardOperation(BaseModel):
    kind: Literal["edit_card"]
    card_id: str = Field(min_length=1)
    title: str | None = None
    details: str | None = None
    priority: Priority | None = None
    due_date: str | None = Field(default=None, pattern=DUE_DATE_PATTERN)


class MoveCardOperation(BaseModel):
    kind: Literal["move_card"]
    card_id: str = Field(min_length=1)
    column_id: str = Field(min_length=1)
    position: int = Field(default=-1, ge=-1)


class DeleteCardOperation(BaseModel):
    kind: Literal["delete_card"]
    card_id: str = Field(min_length=1)


class RenameColumnOperation(BaseModel):
    kind: Literal["rename_column"]
    column_id: str = Field(min_length=1)
    title: str = Field(min_length=1)


BoardOperation = Annotated[
    CreateCardOperation
    | EditCardOperation
    | MoveCardOperation
    | DeleteCardOperation
    | RenameColumnOperation,
    Field(discriminator="kind"),
]


class BoardUpdate(BaseModel):
    operations: list[BoardOperation] = Field(min_length=1)


class StructuredAIResponse(BaseModel):
    assistant_response: str = Field(min_length=1)
    board_update: BoardUpdate | None = None


class AIChatResponse(StructuredAIResponse):
    board: BoardData


def build_messages(board: BoardData, request: AIChatRequest) -> list[dict[str, str]]:
    system = (
        "You are a project management assistant. Return only valid JSON with this "
        'shape: {"assistant_response": string, "board_update": '
        '{"operations": [...] } or null}. Allowed operation kinds are '
        "create_card, edit_card, move_card, delete_card, and rename_column. "
        "For positions, use -1 to append. Use existing IDs for edits, moves, "
        "deletes, and column renames. New card IDs must be unique. "
        "create_card and edit_card also accept an optional priority "
        '("low", "medium", or "high") and due_date ("YYYY-MM-DD").'
    )
    context = json.dumps(
        {
            "current_board": board.model_dump(),
            "question": request.question,
            "conversation_history": [
                message.model_dump() for message in request.history
            ],
        }
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": context},
    ]


def _strip_code_fence(raw_response: str) -> str:
    text = raw_response.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[: -3]
    return text.strip()


def parse_ai_response(raw_response: str) -> StructuredAIResponse:
    try:
        parsed = json.loads(_strip_code_fence(raw_response))
        return StructuredAIResponse.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError, TypeError) as error:
        raise ValueError("AI response was not valid structured JSON") from error


def apply_board_update(board: BoardData, update: BoardUpdate) -> BoardData:
    next_board = board.model_copy(deep=True)
    for operation in update.operations:
        if isinstance(operation, CreateCardOperation):
            _create_card(next_board, operation)
        elif isinstance(operation, EditCardOperation):
            _edit_card(next_board, operation)
        elif isinstance(operation, MoveCardOperation):
            _move_card(next_board, operation)
        elif isinstance(operation, DeleteCardOperation):
            _delete_card(next_board, operation)
        else:
            _rename_column(next_board, operation)
    return next_board


def _column(board: BoardData, column_id: str):
    column = next((item for item in board.columns if item.id == column_id), None)
    if column is None:
        raise ValueError(f"Column not found: {column_id}")
    return column


def _insert_card(column, card_id: str, position: int) -> None:
    insert_at = len(column.cardIds) if position == -1 else min(position, len(column.cardIds))
    column.cardIds.insert(insert_at, card_id)


def _create_card(board: BoardData, operation: CreateCardOperation) -> None:
    if operation.card_id in board.cards:
        raise ValueError(f"Card already exists: {operation.card_id}")
    column = _column(board, operation.column_id)
    board.cards[operation.card_id] = Card(
        id=operation.card_id,
        title=operation.title,
        details=operation.details,
        priority=operation.priority,
        dueDate=operation.due_date,
    )
    _insert_card(column, operation.card_id, operation.position)


def _edit_card(board: BoardData, operation: EditCardOperation) -> None:
    card = board.cards.get(operation.card_id)
    if card is None:
        raise ValueError(f"Card not found: {operation.card_id}")
    changes = (
        operation.title,
        operation.details,
        operation.priority,
        operation.due_date,
    )
    if all(value is None for value in changes):
        raise ValueError("Card edit must change at least one field")
    if operation.title is not None:
        if not operation.title:
            raise ValueError("Card title cannot be empty")
        card.title = operation.title
    if operation.details is not None:
        card.details = operation.details
    if operation.priority is not None:
        card.priority = operation.priority
    if operation.due_date is not None:
        card.dueDate = operation.due_date


def _move_card(board: BoardData, operation: MoveCardOperation) -> None:
    if operation.card_id not in board.cards:
        raise ValueError(f"Card not found: {operation.card_id}")
    target = _column(board, operation.column_id)
    for column in board.columns:
        if operation.card_id in column.cardIds:
            column.cardIds.remove(operation.card_id)
            break
    _insert_card(target, operation.card_id, operation.position)


def _delete_card(board: BoardData, operation: DeleteCardOperation) -> None:
    if operation.card_id not in board.cards:
        raise ValueError(f"Card not found: {operation.card_id}")
    del board.cards[operation.card_id]
    for column in board.columns:
        if operation.card_id in column.cardIds:
            column.cardIds.remove(operation.card_id)
            return


def _rename_column(board: BoardData, operation: RenameColumnOperation) -> None:
    _column(board, operation.column_id).title = operation.title


def generate_structured_response(
    api_key: str, model: str, board: BoardData, request: AIChatRequest
) -> StructuredAIResponse:
    raw_response = ask_openrouter_messages(
        api_key,
        model,
        build_messages(board, request),
        response_format={"type": "json_object"},
    )
    return parse_ai_response(raw_response)
