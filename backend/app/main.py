from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.ai import (
    AIChatRequest,
    AIChatResponse,
    apply_board_update,
    generate_structured_response,
)
from backend.app.database import (
    add_comment,
    authenticate_user,
    create_board,
    create_session,
    create_user,
    delete_board,
    delete_comment,
    delete_session,
    get_username,
    initialize_database,
    list_activity,
    list_boards,
    list_comments,
    read_board,
    rename_board,
    replace_board,
    resolve_session,
)
from backend.app.models import (
    ActivityEntry,
    AuthResponse,
    BoardData,
    BoardSummary,
    Comment,
    CreateBoardRequest,
    CreateCommentRequest,
    LoginRequest,
    RegisterRequest,
    RenameBoardRequest,
    UserPublic,
)
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


def _extract_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip() or None


def current_user_id(authorization: str | None = Header(default=None)) -> str:
    token = _extract_token(authorization)
    if token is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = resolve_session(settings.database_path, token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user_id


@app.post("/api/auth/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest) -> AuthResponse:
    try:
        user_id = create_user(settings.database_path, payload.username, payload.password)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    token = create_session(settings.database_path, user_id)
    return AuthResponse(token=token, user=UserPublic(id=user_id, username=payload.username))


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    user_id = authenticate_user(settings.database_path, payload.username, payload.password)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_session(settings.database_path, user_id)
    return AuthResponse(token=token, user=UserPublic(id=user_id, username=payload.username))


@app.post("/api/auth/logout", status_code=204)
def logout(authorization: str | None = Header(default=None)) -> Response:
    token = _extract_token(authorization)
    if token is not None:
        delete_session(settings.database_path, token)
    return Response(status_code=204)


@app.get("/api/auth/me", response_model=UserPublic)
def me(user_id: str = Depends(current_user_id)) -> UserPublic:
    username = get_username(settings.database_path, user_id)
    if username is None:
        raise HTTPException(status_code=401, detail="Invalid session")
    return UserPublic(id=user_id, username=username)


@app.post("/api/ai/connectivity")
def ai_connectivity(user_id: str = Depends(current_user_id)) -> dict[str, str]:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="OpenRouter API key is not configured")
    try:
        answer = ask_openrouter(
            settings.openrouter_api_key, settings.openrouter_model, "What is 2+2?"
        )
    except OpenRouterError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    return {"model": settings.openrouter_model, "answer": answer}


@app.get("/api/boards", response_model=list[BoardSummary])
def list_boards_route(user_id: str = Depends(current_user_id)) -> list[BoardSummary]:
    return [BoardSummary(**board) for board in list_boards(settings.database_path, user_id)]


@app.post("/api/boards", response_model=BoardSummary, status_code=201)
def create_board_route(
    payload: CreateBoardRequest, user_id: str = Depends(current_user_id)
) -> BoardSummary:
    return BoardSummary(**create_board(settings.database_path, user_id, payload.title))


@app.patch("/api/boards/{board_id}", response_model=BoardSummary)
def rename_board_route(
    board_id: str, payload: RenameBoardRequest, user_id: str = Depends(current_user_id)
) -> BoardSummary:
    result = rename_board(settings.database_path, user_id, board_id, payload.title)
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return BoardSummary(**result)


@app.delete("/api/boards/{board_id}", status_code=204)
def delete_board_route(board_id: str, user_id: str = Depends(current_user_id)) -> Response:
    try:
        deleted = delete_board(settings.database_path, user_id, board_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not deleted:
        raise HTTPException(status_code=404, detail="Board not found")
    return Response(status_code=204)


@app.get("/api/boards/{board_id}", response_model=BoardData)
def get_board_route(board_id: str, user_id: str = Depends(current_user_id)) -> BoardData:
    board = read_board(settings.database_path, user_id, board_id)
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


@app.put("/api/boards/{board_id}", response_model=BoardData)
def update_board_route(
    board_id: str, board_data: BoardData, user_id: str = Depends(current_user_id)
) -> BoardData:
    try:
        result = replace_board(settings.database_path, user_id, board_id, board_data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if result is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return result


@app.get("/api/boards/{board_id}/comments", response_model=list[Comment])
def list_comments_route(
    board_id: str, user_id: str = Depends(current_user_id)
) -> list[Comment]:
    comments = list_comments(settings.database_path, user_id, board_id)
    if comments is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return [Comment(**comment) for comment in comments]


@app.post(
    "/api/boards/{board_id}/cards/{card_id}/comments",
    response_model=Comment,
    status_code=201,
)
def add_comment_route(
    board_id: str,
    card_id: str,
    payload: CreateCommentRequest,
    user_id: str = Depends(current_user_id),
) -> Comment:
    try:
        comment = add_comment(
            settings.database_path, user_id, board_id, card_id, payload.body
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if comment is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return Comment(**comment)


@app.delete("/api/boards/{board_id}/comments/{comment_id}", status_code=204)
def delete_comment_route(
    board_id: str, comment_id: str, user_id: str = Depends(current_user_id)
) -> Response:
    if not delete_comment(settings.database_path, user_id, board_id, comment_id):
        raise HTTPException(status_code=404, detail="Comment not found")
    return Response(status_code=204)


@app.get("/api/boards/{board_id}/activity", response_model=list[ActivityEntry])
def list_activity_route(
    board_id: str, user_id: str = Depends(current_user_id)
) -> list[ActivityEntry]:
    activity = list_activity(settings.database_path, user_id, board_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return [ActivityEntry(**entry) for entry in activity]


@app.post("/api/boards/{board_id}/ai/chat", response_model=AIChatResponse)
def ai_chat(
    board_id: str,
    request: AIChatRequest,
    user_id: str = Depends(current_user_id),
) -> AIChatResponse:
    board = read_board(settings.database_path, user_id, board_id)
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
        current_board = read_board(settings.database_path, user_id, board_id)
        if current_board is None:
            raise HTTPException(status_code=404, detail="Board not found")
        updated_board = apply_board_update(current_board, structured.board_update)
        saved_board = replace_board(settings.database_path, user_id, board_id, updated_board)
        if saved_board is None:
            raise HTTPException(status_code=404, detail="Board not found")
        return AIChatResponse(
            assistant_response=structured.assistant_response,
            board_update=structured.board_update,
            board=saved_board,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except OpenRouterError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


if FRONTEND_DIR.is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")
