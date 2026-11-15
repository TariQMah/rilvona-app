import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import Settings
from app.llm import ModelError, run_chat
from app.schemas import ChatMessage
from tests.conftest import make_context

SETTINGS = Settings(service_key="secret", mistral_api_key="k", mistral_model="m", mistral_base_url="https://mistral.test/v1")


def fake_mistral(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


async def test_tool_call_round_trip_uses_real_numbers():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append(body)
        if len(seen) == 1:
            assert body["tools"] and body["messages"][0]["role"] == "system"
            return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": "", "tool_calls": [
                {"id": "c1", "type": "function", "function": {"name": "get_attendance", "arguments": json.dumps({"course": "python"})}}]}}]})
        tool_message = body["messages"][-1]
        assert tool_message["role"] == "tool" and json.loads(tool_message["content"])["percent"] == 82.0
        return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": "You are at **82%** in Python."}}]})

    async with fake_mistral(handler) as client:
        reply, used = await run_chat(SETTINGS, [ChatMessage(role="user", content="python attendance?")], make_context(), client)
    assert reply == "You are at **82%** in Python." and used == ["get_attendance"]


async def test_provider_errors_become_model_error():
    async with fake_mistral(lambda r: httpx.Response(401, json={"message": "bad key"})) as client:
        with pytest.raises(ModelError):
            await run_chat(SETTINGS, [ChatMessage(role="user", content="hi")], make_context(), client)


def _client(monkeypatch, settings=SETTINGS):
    monkeypatch.setattr(main, "_settings", settings)
    return TestClient(main.app)


def test_endpoint_requires_the_service_key(monkeypatch):
    client = _client(monkeypatch)
    payload = {"messages": [{"role": "user", "content": "hi"}], "context": make_context().model_dump()}
    assert client.post("/v1/chat", json=payload).status_code == 401
    assert client.post("/v1/chat", json=payload, headers={"X-Service-Key": "wrong"}).status_code == 401
    assert client.get("/health").json()["ok"] is True


def test_endpoint_rejects_a_conversation_that_ends_with_the_assistant(monkeypatch):
    client = _client(monkeypatch)
    payload = {"messages": [{"role": "assistant", "content": "hi"}], "context": make_context().model_dump()}
    assert client.post("/v1/chat", json=payload, headers={"X-Service-Key": "secret"}).status_code == 422


async def test_rate_limits_are_retried_then_succeed(monkeypatch):
    import app.llm as llm

    async def no_sleep(_):
        return None

    monkeypatch.setattr(llm.asyncio, "sleep", no_sleep)
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) < 3:
            return httpx.Response(429, json={"message": "Rate limit exceeded"})
        return httpx.Response(200, json={"choices": [{"message": {"role": "assistant", "content": "ok"}}]})

    async with fake_mistral(handler) as client:
        reply, used = await run_chat(SETTINGS, [ChatMessage(role="user", content="hi")], make_context(), client)
    assert reply == "ok" and len(calls) == 3
