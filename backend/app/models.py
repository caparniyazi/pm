from typing import Literal

from pydantic import BaseModel, Field, field_validator

Priority = Literal["low", "medium", "high"]

DUE_DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

MAX_LABELS_PER_CARD = 10
MAX_LABEL_LENGTH = 32


def normalize_labels(value: list[str]) -> list[str]:
    """Trim, drop case-insensitive duplicates, and bound labels.

    Shared by the Card model and the AI card operations so both accept the
    same input and store the same canonical form.
    """
    cleaned: list[str] = []
    lowered: set[str] = set()
    for raw in value:
        label = raw.strip()
        if not label:
            raise ValueError("Labels cannot be empty")
        if len(label) > MAX_LABEL_LENGTH:
            raise ValueError(f"Labels cannot exceed {MAX_LABEL_LENGTH} characters")
        if label.lower() in lowered:
            continue
        lowered.add(label.lower())
        cleaned.append(label)
    if len(cleaned) > MAX_LABELS_PER_CARD:
        raise ValueError(f"A card can have at most {MAX_LABELS_PER_CARD} labels")
    return cleaned


class Card(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    details: str = ""
    priority: Priority | None = None
    dueDate: str | None = Field(default=None, pattern=DUE_DATE_PATTERN)
    labels: list[str] = Field(default_factory=list)

    @field_validator("labels")
    @classmethod
    def _validate_labels(cls, value: list[str]) -> list[str]:
        return normalize_labels(value)


class Column(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    cardIds: list[str] = Field(default_factory=list)


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class BoardSummary(BaseModel):
    id: str
    title: str
    updatedAt: str


class CreateBoardRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class RenameBoardRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class UserPublic(BaseModel):
    id: str
    username: str


class AuthResponse(BaseModel):
    token: str
    user: UserPublic


MAX_COMMENT_LENGTH = 2000

ActivityKind = Literal[
    "card_created",
    "card_edited",
    "card_moved",
    "card_deleted",
    "column_renamed",
    "comment_added",
    "comment_deleted",
]


class CreateCommentRequest(BaseModel):
    body: str = Field(min_length=1, max_length=MAX_COMMENT_LENGTH)


class Comment(BaseModel):
    id: str
    cardId: str
    author: str
    body: str
    createdAt: str


class ActivityEntry(BaseModel):
    id: str
    kind: ActivityKind
    summary: str
    cardId: str | None = None
    createdAt: str
