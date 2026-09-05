import json
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


def register(client: TestClient, username: str = "alice", password: str = "password123") -> dict:
    response = client.post(
        "/api/auth/register", json={"username": username, "password": password}
    )
    assert response.status_code == 201, response.text
    return response.json()


def auth_headers(client: TestClient, username: str = "alice", password: str = "password123") -> dict:
    token = register(client, username, password)["token"]
    return {"Authorization": f"Bearer {token}"}


def first_board_id(client: TestClient, headers: dict) -> str:
    boards = client.get("/api/boards", headers=headers).json()
    return boards[0]["id"]


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


def test_boards_require_authentication(client: TestClient) -> None:
    assert client.get("/api/boards").status_code == 401
    assert client.get("/api/boards/board-1").status_code == 401
    assert client.post("/api/ai/connectivity").status_code == 401


def test_invalid_bearer_token_is_rejected(client: TestClient) -> None:
    response = client.get("/api/boards", headers={"Authorization": "Bearer not-a-real-token"})

    assert response.status_code == 401


class TestRegistration:
    def test_register_creates_user_and_default_board(self, client: TestClient) -> None:
        body = register(client)

        assert body["user"]["username"] == "alice"
        assert body["token"]

        headers = {"Authorization": f"Bearer {body['token']}"}
        boards = client.get("/api/boards", headers=headers).json()
        assert len(boards) == 1
        assert boards[0]["title"] == "My Board"

        board = client.get(f"/api/boards/{boards[0]['id']}", headers=headers).json()
        assert [column["title"] for column in board["columns"]] == [
            "Backlog",
            "Discovery",
            "In Progress",
            "Review",
            "Done",
        ]
        assert board["cards"] == {}

    def test_register_rejects_duplicate_username(self, client: TestClient) -> None:
        register(client, "alice")

        response = client.post(
            "/api/auth/register", json={"username": "alice", "password": "password123"}
        )

        assert response.status_code == 409

    def test_register_rejects_short_password(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/register", json={"username": "alice", "password": "short"}
        )

        assert response.status_code == 422


class TestLogin:
    def test_login_succeeds_with_correct_credentials(self, client: TestClient) -> None:
        register(client, "alice", "password123")

        response = client.post(
            "/api/auth/login", json={"username": "alice", "password": "password123"}
        )

        assert response.status_code == 200
        assert response.json()["user"]["username"] == "alice"

    def test_login_fails_with_wrong_password(self, client: TestClient) -> None:
        register(client, "alice", "password123")

        response = client.post(
            "/api/auth/login", json={"username": "alice", "password": "wrong-password"}
        )

        assert response.status_code == 401

    def test_login_fails_for_unknown_user(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/login", json={"username": "ghost", "password": "password123"}
        )

        assert response.status_code == 401

    def test_seeded_demo_user_can_log_in(self, client: TestClient) -> None:
        response = client.post(
            "/api/auth/login", json={"username": "user", "password": "password"}
        )

        assert response.status_code == 200


class TestLogoutAndMe:
    def test_me_returns_current_user(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")

        response = client.get("/api/auth/me", headers=headers)

        assert response.status_code == 200
        assert response.json()["username"] == "alice"

    def test_logout_invalidates_the_session(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")

        logout_response = client.post("/api/auth/logout", headers=headers)
        assert logout_response.status_code == 204

        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 401


class TestMultipleBoards:
    def test_create_and_list_boards(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")

        create_response = client.post(
            "/api/boards", headers=headers, json={"title": "Second Board"}
        )
        assert create_response.status_code == 201

        boards = client.get("/api/boards", headers=headers).json()
        titles = {board["title"] for board in boards}
        assert titles == {"My Board", "Second Board"}

    def test_rename_board(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")
        board_id = first_board_id(client, headers)

        response = client.patch(
            f"/api/boards/{board_id}", headers=headers, json={"title": "Renamed"}
        )

        assert response.status_code == 200
        assert response.json()["title"] == "Renamed"

    def test_rename_missing_board_is_404(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")

        response = client.patch(
            "/api/boards/missing", headers=headers, json={"title": "Renamed"}
        )

        assert response.status_code == 404

    def test_delete_board_removes_it(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")
        created = client.post(
            "/api/boards", headers=headers, json={"title": "Second Board"}
        ).json()

        response = client.delete(f"/api/boards/{created['id']}", headers=headers)

        assert response.status_code == 204
        boards = client.get("/api/boards", headers=headers).json()
        assert len(boards) == 1

    def test_cannot_delete_only_board(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")
        board_id = first_board_id(client, headers)

        response = client.delete(f"/api/boards/{board_id}", headers=headers)

        assert response.status_code == 400

    def test_users_cannot_access_each_others_boards(self, client: TestClient) -> None:
        alice_headers = auth_headers(client, "alice")
        bob_headers = auth_headers(client, "bob")
        alice_board_id = first_board_id(client, alice_headers)

        assert client.get(f"/api/boards/{alice_board_id}", headers=bob_headers).status_code == 404
        assert (
            client.patch(
                f"/api/boards/{alice_board_id}", headers=bob_headers, json={"title": "x"}
            ).status_code
            == 404
        )
        assert client.delete(f"/api/boards/{alice_board_id}", headers=bob_headers).status_code == 404


class TestBoardContents:
    def test_board_can_be_read_and_updated(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")
        board_id = first_board_id(client, headers)
        board = client.get(f"/api/boards/{board_id}", headers=headers).json()
        board["columns"][0]["title"] = "Ideas"

        update = client.put(f"/api/boards/{board_id}", headers=headers, json=board)

        assert update.status_code == 200
        assert update.json()["columns"][0]["title"] == "Ideas"

    def test_put_board_rejects_renamed_column_id(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")
        board_id = first_board_id(client, headers)
        board = client.get(f"/api/boards/{board_id}", headers=headers).json()
        board["columns"][0]["id"] = "col-renamed"

        response = client.put(f"/api/boards/{board_id}", headers=headers, json=board)

        assert response.status_code == 400
        assert "added or removed" in response.json()["detail"]

    def test_put_board_rejects_removed_column(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")
        board_id = first_board_id(client, headers)
        board = client.get(f"/api/boards/{board_id}", headers=headers).json()
        dropped = board["columns"].pop()
        board["columns"][-1]["cardIds"] += dropped["cardIds"]

        response = client.put(f"/api/boards/{board_id}", headers=headers, json=board)

        assert response.status_code == 400


class TestAIChat:
    def test_ai_chat_reports_missing_key(self, client: TestClient) -> None:
        headers = auth_headers(client, "alice")
        board_id = first_board_id(client, headers)

        response = client.post(
            f"/api/boards/{board_id}/ai/chat",
            headers=headers,
            json={"question": "Summarize my board"},
        )

        assert response.status_code == 503

    def test_ai_chat_does_not_access_another_users_board(self, ai_client: TestClient) -> None:
        alice_headers = auth_headers(ai_client, "alice")
        bob_headers = auth_headers(ai_client, "bob")
        alice_board_id = first_board_id(ai_client, alice_headers)

        response = ai_client.post(
            f"/api/boards/{alice_board_id}/ai/chat",
            headers=bob_headers,
            json={"question": "Summarize my board"},
        )

        assert response.status_code == 404

    def test_ai_chat_response_only_leaves_board_unchanged(
        self, ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        headers = auth_headers(ai_client, "alice")
        board_id = first_board_id(ai_client, headers)
        stub_model(
            monkeypatch,
            {"assistant_response": "Here is a summary.", "board_update": None},
        )
        before = ai_client.get(f"/api/boards/{board_id}", headers=headers).json()

        response = ai_client.post(
            f"/api/boards/{board_id}/ai/chat",
            headers=headers,
            json={"question": "Summarize my board"},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["assistant_response"] == "Here is a summary."
        assert body["board_update"] is None
        assert body["board"] == before
        assert ai_client.get(f"/api/boards/{board_id}", headers=headers).json() == before

    def test_ai_chat_applies_and_persists_board_update(
        self, ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        headers = auth_headers(ai_client, "alice")
        board_id = first_board_id(ai_client, headers)
        board = ai_client.get(f"/api/boards/{board_id}", headers=headers).json()
        column_id = board["columns"][0]["id"]
        stub_model(
            monkeypatch,
            {
                "assistant_response": "Renamed the column.",
                "board_update": {
                    "operations": [
                        {
                            "kind": "rename_column",
                            "column_id": column_id,
                            "title": "Ideas",
                        }
                    ]
                },
            },
        )

        response = ai_client.post(
            f"/api/boards/{board_id}/ai/chat",
            headers=headers,
            json={"question": "Rename Backlog to Ideas"},
        )

        assert response.status_code == 200
        assert response.json()["board"]["columns"][0]["title"] == "Ideas"
        persisted = ai_client.get(f"/api/boards/{board_id}", headers=headers).json()
        assert persisted["columns"][0]["title"] == "Ideas"

    def test_ai_chat_rolls_back_when_an_operation_is_invalid(
        self, ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        headers = auth_headers(ai_client, "alice")
        board_id = first_board_id(ai_client, headers)
        board = ai_client.get(f"/api/boards/{board_id}", headers=headers).json()
        column_id = board["columns"][0]["id"]
        stub_model(
            monkeypatch,
            {
                "assistant_response": "Trying.",
                "board_update": {
                    "operations": [
                        {
                            "kind": "rename_column",
                            "column_id": column_id,
                            "title": "Ideas",
                        },
                        {"kind": "delete_card", "card_id": "missing-card"},
                    ]
                },
            },
        )
        before = ai_client.get(f"/api/boards/{board_id}", headers=headers).json()

        response = ai_client.post(
            f"/api/boards/{board_id}/ai/chat", headers=headers, json={"question": "Do it"}
        )

        assert response.status_code == 400
        assert ai_client.get(f"/api/boards/{board_id}", headers=headers).json() == before

    def test_ai_chat_rejects_non_json_model_output(
        self, ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        headers = auth_headers(ai_client, "alice")
        board_id = first_board_id(ai_client, headers)
        stub_model(monkeypatch, "I cannot help with that right now.")

        response = ai_client.post(
            f"/api/boards/{board_id}/ai/chat", headers=headers, json={"question": "Do it"}
        )

        assert response.status_code == 400

    def test_ai_chat_tolerates_code_fenced_json(
        self, ai_client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        headers = auth_headers(ai_client, "alice")
        board_id = first_board_id(ai_client, headers)
        body = json.dumps({"assistant_response": "ok", "board_update": None})
        stub_model(monkeypatch, f"```json\n{body}\n```")

        response = ai_client.post(
            f"/api/boards/{board_id}/ai/chat", headers=headers, json={"question": "Hello"}
        )

        assert response.status_code == 200
        assert response.json()["assistant_response"] == "ok"
