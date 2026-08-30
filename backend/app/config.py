import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    openrouter_api_key: str | None = None
    openrouter_model: str = "openai/gpt-oss-120b"
    database_path: str = "data/pm.sqlite3"


settings = Settings(
    openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
    openrouter_model=os.getenv("OPENROUTER_MODEL", "openai/gpt-oss-120b"),
    database_path=os.getenv("DATABASE_PATH", "data/pm.sqlite3"),
)
