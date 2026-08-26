import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    openrouter_api_key: str | None


settings = Settings(
    openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
)
