from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi import Header, HTTPException
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.ai import (
    AIChatRequest,
    AIChatResponse,
    apply_board_update,
    generate_structured_response,
)
from backend.app.database import initialize_database, read_board, replace_board
from backend.app.models import BoardData
from backend.app.openrouter import OpenRouterError, ask_openrouter

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
FRONTEND_DIR = BASE_DIR.parent.parent / "frontend" / "out"

@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database(settings.database_path)
    yield


app = FastAPI(title="Project Management MVP", lifespan=lifespan)


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "Hello from the Project Management API"}


def current_user_id(x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User identity is required")
    return x_user_id


@app.post("/api/ai/connectivity")
def ai_connectivity(x_user_id: str | None = Header(default=None)) -> dict[str, str]:
    current_user_id(x_user_id)
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OpenRouter API key is not configured")
    try:
        answer = ask_openrouter(
            settings.openrouter_api_key, settings.openrouter_model, "What is 2+2?"
        )
    except OpenRouterError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {"model": settings.openrouter_model, "answer": answer}


@app.post("/api/ai/chat", response_model=AIChatResponse)
def ai_chat(
    request: AIChatRequest,
    x_user_id: str | None = Header(default=None),
) -> AIChatResponse:
    user_id = current_user_id(x_user_id)
    board = read_board(settings.database_path, user_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OpenRouter API key is not configured")
    try:
        structured = generate_structured_response(
            settings.openrouter_api_key, settings.openrouter_model, board, request
        )
        if structured.board_update is None:
            return AIChatResponse(
                assistant_response=structured.assistant_response,
                board_update=None,
                board=board,
            )
        # Re-read so the update applies to current state, not the pre-request snapshot.
        current_board = read_board(settings.database_path, user_id)
        if current_board is None:
            raise HTTPException(status_code=404, detail="Board not found")
        updated_board = apply_board_update(current_board, structured.board_update)
        saved_board = replace_board(settings.database_path, user_id, updated_board)
        return AIChatResponse(
            assistant_response=structured.assistant_response,
            board_update=structured.board_update,
            board=saved_board,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except OpenRouterError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@app.get("/api/board", response_model=BoardData)
def get_board(x_user_id: str | None = Header(default=None)) -> BoardData:
    user_id = current_user_id(x_user_id)
    board = read_board(settings.database_path, user_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@app.put("/api/board", response_model=BoardData)
def update_board(
    board_data: BoardData,
    x_user_id: str | None = Header(default=None),
) -> BoardData:
    user_id = current_user_id(x_user_id)
    try:
        return replace_board(settings.database_path, user_id, board_data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


if FRONTEND_DIR.is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")
