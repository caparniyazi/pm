import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    openrouter_api_key: str | None
    database_path: str


settings = Settings(
    openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
    database_path=os.getenv("DATABASE_PATH", "data/pm.sqlite3"),
)
