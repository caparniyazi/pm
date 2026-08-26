from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
FRONTEND_DIR = BASE_DIR.parent.parent / "frontend" / "out"

app = FastAPI(title="Project Management MVP")


@app.get("/api/hello")
def hello() -> dict[str, str]:
    return {"message": "Hello from the Project Management API"}


if FRONTEND_DIR.is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")
