"""Talks to Mistral's chat API and runs the tool-calling loop."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx

from .config import Settings
from .prompt import build_system_prompt
from .schemas import ChatMessage, StudentContext
from .tools import TOOL_SPECS, Toolbox

log = logging.getLogger("rilvona.ai")


class ModelError(Exception):
    """The model provider failed or answered with something unusable."""


async def _complete(client: httpx.AsyncClient, settings: Settings, payload: dict[str, Any]) -> dict[str, Any]:
    """One model call. Rate limits and provider hiccups are retried a couple of times with a growing pause."""
    last: Exception | None = None
    for attempt in range(3):
        try:
            response = await client.post(
                f"{settings.mistral_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.mistral_api_key}"},
                json=payload,
            )
        except httpx.HTTPError as exc:
            last = exc
            if attempt < 2:
                await asyncio.sleep(1.5 * (attempt + 1))
            continue
        if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
            try:
                wait = float(response.headers.get("retry-after", ""))
            except ValueError:
                wait = 1.5 * (attempt + 1)
            await asyncio.sleep(min(max(wait, 1.0), 6.0))
            continue
        if response.status_code >= 400:
            log.error("mistral error %s: %s", response.status_code, response.text[:300])
            raise ModelError(f"model provider answered {response.status_code}")
        return response.json()
    raise ModelError(f"could not reach the model provider: {last}")


async def run_chat(
    settings: Settings,
    messages: list[ChatMessage],
    ctx: StudentContext,
    client: httpx.AsyncClient | None = None,
) -> tuple[str, list[str]]:
    """Returns the assistant's reply and the names of the tools it used."""
    toolbox = Toolbox(ctx)
    convo: list[dict[str, Any]] = [{"role": "system", "content": build_system_prompt(ctx, toolbox)}]
    convo += [{"role": m.role, "content": m.content} for m in messages[-14:]]
    used: list[str] = []

    own_client = client is None
    http = client or httpx.AsyncClient(timeout=settings.request_timeout)
    try:
        for round_number in range(settings.max_tool_rounds + 1):
            payload: dict[str, Any] = {
                "model": settings.mistral_model,
                "messages": convo,
                "temperature": 0.3,
                "max_tokens": 900,
            }
            if round_number < settings.max_tool_rounds:
                payload["tools"] = TOOL_SPECS
                payload["tool_choice"] = "auto"
            data = await _complete(http, settings, payload)
            try:
                message = data["choices"][0]["message"]
            except (KeyError, IndexError, TypeError) as exc:
                raise ModelError("unexpected answer from the model provider") from exc

            calls = message.get("tool_calls") or []
            if not calls:
                reply = message.get("content")
                if isinstance(reply, list):  # content can come back as parts
                    reply = "".join(part.get("text", "") for part in reply if isinstance(part, dict))
                reply = (reply or "").strip()
                if not reply:
                    raise ModelError("the model returned an empty answer")
                return reply, used

            convo.append(
                {"role": "assistant", "content": message.get("content") or "", "tool_calls": calls}
            )
            for call in calls:
                fn = call.get("function", {})
                name = fn.get("name", "")
                raw = fn.get("arguments") or "{}"
                try:
                    args = json.loads(raw) if isinstance(raw, str) else dict(raw)
                except (ValueError, TypeError):
                    args = {}
                result = toolbox.call(name, args if isinstance(args, dict) else {})
                used.append(name)
                convo.append(
                    {
                        "role": "tool",
                        "name": name,
                        "tool_call_id": call.get("id", ""),
                        "content": json.dumps(result, ensure_ascii=False),
                    }
                )
        raise ModelError("the model kept calling tools without answering")
    finally:
        if own_client:
            await http.aclose()
