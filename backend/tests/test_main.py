from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_hello_endpoint() -> None:
    response = client.get("/api/hello")

    assert response.status_code == 200
    assert response.json() == {"message": "Hello from the Project Management API"}


def test_root_serves_static_html() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Kanban Studio" in response.text
