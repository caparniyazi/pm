import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import backend.app.main as main_module
from backend.app.config import Settings

USER = {"X-User-Id": "user-1"}


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        main_module,
        "settings",
        Settings(openrouter_api_key=None, database_path=str(tmp_path / "pm.sqlite3")),
    )
    with TestClient(main_module.app) as test_client:
        yield test_client


@pytest.fixture
def ai_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        main_module,
        "settings",
        Settings(
            openrouter_api_key="test-key",
            database_path=str(tmp_path / "pm.sqlite3"),
        ),
    )
    with TestClient(main_module.app) as test_client:
        yield test_client


def stub_model(monkeypatch: pytest.MonkeyPatch, raw: str | dict) -> None:
    text = raw if isinstance(raw, str) else json.dumps(raw)
    monkeypatch.setattr(
        "backend.app.ai.ask_openrouter_messages",
        lambda *args, **kwargs: text,
    )


def test_hello_endpoint(client: TestClient) -> None:
    response = client.get("/api/hello")

    assert response.status_code == 200
    assert response.json() == {"message": "Hello from the Project Management API"}


def test_root_serves_static_html(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Kanban Studio" in response.text


def test_board_requires_user_identity(client: TestClient) -> None:
    response = client.get("/api/board")

    assert response.status_code == 401


def test_ai_connectivity_requires_user_identity(client: TestClient) -> None:
    response = client.post("/api/ai/connectivity")

    assert response.status_code == 401


def test_ai_connectivity_reports_missing_key(client: TestClient) -> None:
    response = client.post(
        "/api/ai/connectivity",
        headers={"X-User-Id": "user-1"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "OpenRouter API key is not configured"


def test_ai_chat_reports_missing_key(client: TestClient) -> None:
    response = client.post(
        "/api/ai/chat",
        headers={"X-User-Id": "user-1"},
        json={"question": "Summarize my board"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "OpenRouter API key is not configured"


def test_ai_chat_does_not_access_another_users_board(client: TestClient) -> None:
    response = client.post(
        "/api/ai/chat",
        headers={"X-User-Id": "missing-user"},
        json={"question": "Summarize my board"},
    )

    assert response.status_code == 404


def test_unknown_user_has_no_board(client: TestClient) -> None:
    response = client.get("/api/board", headers={"X-User-Id": "missing-user"})

    assert response.status_code == 404


def test_board_can_be_read_and_updated(client: TestClient) -> None:
    headers = {"X-User-Id": "user-1"}
    response = client.get("/api/board", headers=headers)
    assert response.status_code == 200
    board = response.json()
    board["columns"][0]["title"] = "Ideas"

    update = client.put("/api/board", headers=headers, json=board)

    assert update.status_code == 200
    assert update.json()["columns"][0]["title"] == "Ideas"


def test_put_board_rejects_renamed_column_id(client: TestClient) -> None:
    board = client.get("/api/board", headers=USER).json()
    board["columns"][0]["id"] = "col-renamed"

    response = client.put("/api/board", headers=USER, json=board)

    assert response.status_code == 400
    assert "added or removed" in response.json()["detail"]


def test_put_board_rejects_removed_column(client: TestClient) -> None:
    board = client.get("/api/board", headers=USER).json()
    dropped = board["columns"].pop()
    board["columns"][-1]["cardIds"] += dropped["cardIds"]

    response = client.put("/api/board", headers=USER, json=board)

    assert response.status_code == 400


def test_ai_chat_response_only_leaves_board_unchanged(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub_model(
        monkeypatch,
        {"assistant_response": "Here is a summary.", "board_update": None},
    )
    before = ai_client.get("/api/board", headers=USER).json()

    response = ai_client.post(
        "/api/ai/chat", headers=USER, json={"question": "Summarize my board"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["assistant_response"] == "Here is a summary."
    assert body["board_update"] is None
    assert body["board"] == before
    assert ai_client.get("/api/board", headers=USER).json() == before


def test_ai_chat_applies_and_persists_board_update(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub_model(
        monkeypatch,
        {
            "assistant_response": "Renamed the column.",
            "board_update": {
                "operations": [
                    {
                        "kind": "rename_column",
                        "column_id": "col-backlog",
                        "title": "Ideas",
                    }
                ]
            },
        },
    )

    response = ai_client.post(
        "/api/ai/chat", headers=USER, json={"question": "Rename Backlog to Ideas"}
    )

    assert response.status_code == 200
    assert response.json()["board"]["columns"][0]["title"] == "Ideas"
    persisted = ai_client.get("/api/board", headers=USER).json()
    assert persisted["columns"][0]["title"] == "Ideas"


def test_ai_chat_supports_every_operation(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub_model(
        monkeypatch,
        {
            "assistant_response": "Reorganized the board.",
            "board_update": {
                "operations": [
                    {
                        "kind": "create_card",
                        "card_id": "card-new",
                        "title": "New card",
                        "column_id": "col-backlog",
                    },
                    {"kind": "edit_card", "card_id": "card-1", "details": "Updated"},
                    {
                        "kind": "move_card",
                        "card_id": "card-1",
                        "column_id": "col-done",
                    },
                    {
                        "kind": "rename_column",
                        "column_id": "col-review",
                        "title": "QA",
                    },
                    {"kind": "delete_card", "card_id": "card-2"},
                ]
            },
        },
    )

    response = ai_client.post(
        "/api/ai/chat", headers=USER, json={"question": "Reorganize"}
    )

    assert response.status_code == 200
    persisted = ai_client.get("/api/board", headers=USER).json()
    columns = {column["id"]: column for column in persisted["columns"]}
    assert "card-new" in persisted["cards"]
    assert "card-2" not in persisted["cards"]
    assert persisted["cards"]["card-1"]["details"] == "Updated"
    assert "card-1" in columns["col-done"]["cardIds"]
    assert columns["col-review"]["title"] == "QA"


def test_ai_chat_rolls_back_when_an_operation_is_invalid(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub_model(
        monkeypatch,
        {
            "assistant_response": "Trying.",
            "board_update": {
                "operations": [
                    {
                        "kind": "rename_column",
                        "column_id": "col-backlog",
                        "title": "Ideas",
                    },
                    {"kind": "delete_card", "card_id": "missing-card"},
                ]
            },
        },
    )
    before = ai_client.get("/api/board", headers=USER).json()

    response = ai_client.post(
        "/api/ai/chat", headers=USER, json={"question": "Do it"}
    )

    assert response.status_code == 400
    assert ai_client.get("/api/board", headers=USER).json() == before


def test_ai_chat_rejects_non_json_model_output(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub_model(monkeypatch, "I cannot help with that right now.")

    response = ai_client.post(
        "/api/ai/chat", headers=USER, json={"question": "Do it"}
    )

    assert response.status_code == 400


def test_ai_chat_tolerates_code_fenced_json(
    ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    body = json.dumps({"assistant_response": "ok", "board_update": None})
    stub_model(monkeypatch, f"```json\n{body}\n```")

    response = ai_client.post(
        "/api/ai/chat", headers=USER, json={"question": "Hello"}
    )

    assert response.status_code == 200
    assert response.json()["assistant_response"] == "ok"
