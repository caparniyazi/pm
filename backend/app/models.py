from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["low", "medium", "high"]

DUE_DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class Card(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    details: str = ""
    priority: Priority | None = None
    dueDate: str | None = Field(default=None, pattern=DUE_DATE_PATTERN)


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
