"""Rilvona AI service. Listens on localhost only; the Rilvona API is its one caller."""

from __future__ import annotations

import hmac
import logging

from fastapi import Depends, FastAPI, Header, HTTPException

from .config import Settings, load_settings
from .llm import ModelError, run_chat
from .schemas import ChatRequest, ChatResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("rilvona.ai")

app = FastAPI(title="Rilvona AI", docs_url=None, redoc_url=None, openapi_url=None)
_settings = load_settings()


def get_settings() -> Settings:
    return _settings


def require_key(
    x_service_key: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not settings.service_key or not x_service_key or not hmac.compare_digest(x_service_key, settings.service_key):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
async def health(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    return {"ok": True, "model": settings.mistral_model, "configured": bool(settings.mistral_api_key)}


@app.post("/v1/chat", response_model=ChatResponse, dependencies=[Depends(require_key)])
async def chat(body: ChatRequest, settings: Settings = Depends(get_settings)) -> ChatResponse:
    if not settings.mistral_api_key:
        raise HTTPException(status_code=503, detail="model not configured")
    if body.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="the last message must come from the student")
    try:
        reply, used = await run_chat(settings, body.messages, body.context)
    except ModelError as exc:
        log.error("chat failed: %s", exc)
        raise HTTPException(status_code=502, detail="model unavailable") from exc
    log.info("chat ok tools=%s", ",".join(used) or "-")
    return ChatResponse(reply=reply, toolsUsed=used)
