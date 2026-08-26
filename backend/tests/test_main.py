from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import backend.app.main as main_module
from backend.app.config import Settings


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        main_module,
        "settings",
        Settings(openrouter_api_key=None, database_path=str(tmp_path / "pm.sqlite3")),
    )
    with TestClient(main_module.app) as test_client:
        yield test_client


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
