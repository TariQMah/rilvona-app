"""Settings, read from the environment (a .env file next to this folder is loaded by the process manager)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    service_key: str
    mistral_api_key: str
    mistral_model: str
    mistral_base_url: str
    request_timeout: float = 40.0
    max_tool_rounds: int = 5


def load_settings() -> Settings:
    return Settings(
        service_key=os.environ.get("AI_SERVICE_KEY", ""),
        mistral_api_key=os.environ.get("MISTRAL_API_KEY", ""),
        mistral_model=os.environ.get("MISTRAL_MODEL")
        or os.environ.get("MISTRAL_CHAT_MODEL")
        or "ministral-8b-latest",
        mistral_base_url=os.environ.get("MISTRAL_BASE_URL", "https://api.mistral.ai/v1").rstrip("/"),
    )
