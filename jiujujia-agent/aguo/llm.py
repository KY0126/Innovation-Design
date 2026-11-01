"""AI顧問阿國唯一的 LLM 介面（ARCHITECTURE.md §7.4 第 8 條：其他地方一律不准直接呼叫 LLM）。

任何 OpenAI 相容 API（預設 Cloudflare Workers AI 的 Llama 3.3）。金鑰只放 jiujujia-agent/.env；
測試與 CI 一律用 tests/fake_llm.py 的模擬 LLM。送出前會遮蔽電話與 Email 格式的字串（個資最少）。
"""
from __future__ import annotations

import json
import os
import re
import uuid
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLACEHOLDERS = {"", "your_token_here", "your_account_id_here", "changeme"}
DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
DEFAULT_VERIFIER = "@cf/mistralai/mistral-small-3.1-24b-instruct"

_PHONE = re.compile(r"(?<!\d)(?:09\d{2}-?\d{3}-?\d{3}|0\d{1,2}-?\d{6,8})(?!\d)")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


def redact(text: str) -> str:
    """送給 LLM 前遮蔽電話與 Email。姓名無法靠格式判斷，由各能力只傳必要欄位（#21 再加自動檢查）。"""
    return _EMAIL.sub("［Email 已遮蔽］", _PHONE.sub("［電話已遮蔽］", text or ""))


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class LLMReply:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)


def _args(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    try:
        v = json.loads(raw or "{}")
        return v if isinstance(v, dict) else {}
    except json.JSONDecodeError:
        return {"__unparsable__": str(raw)[:200]}


_TEXT_CALL = re.compile(r'\{\s*"(?:type"\s*:\s*"function"\s*,\s*")?name"\s*:\s*"(\w+)"\s*,\s*"(?:parameters|arguments)"\s*:\s*(\{.*?\})\s*\}',
                        re.S)


def parse_text_tool_calls(content: str, known: set[str]) -> list[ToolCall]:
    """Llama 有時把工具呼叫寫成文字 JSON，而不是 tool_calls 欄位；這裡把它撿回來。"""
    out = []
    for m in _TEXT_CALL.finditer(content or ""):
        if m.group(1) in known:
            out.append(ToolCall(f"txt-{uuid.uuid4().hex[:8]}", m.group(1), _args(m.group(2))))
    return out


class OpenAICompatLLM:
    def __init__(self, base_url: str, api_key: str, model: str, max_tokens: int = 1500, timeout: float = 60):
        from openai import AsyncOpenAI
        self.client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
        self.model = model
        self.max_tokens = max_tokens

    async def chat(self, messages: list[dict], tools: list[dict] | None = None) -> LLMReply:
        messages = [{**m, "content": redact(m["content"])} if isinstance(m.get("content"), str) else m
                    for m in messages]
        kw = dict(model=self.model, messages=messages, temperature=0, max_tokens=self.max_tokens)
        if tools:
            kw.update(tools=tools, tool_choice="auto")
        r = await self.client.chat.completions.create(**kw)
        msg = r.choices[0].message
        calls = [ToolCall(tc.id or f"tc-{uuid.uuid4().hex[:8]}", tc.function.name, _args(tc.function.arguments))
                 for tc in (msg.tool_calls or [])]
        content = msg.content or ""
        if tools and not calls:
            calls = parse_text_tool_calls(content, {t["function"]["name"] for t in tools})
            if calls:
                content = ""
        return LLMReply(content=content, tool_calls=calls)


class LLMNotConfigured(RuntimeError):
    """沒有 .env 或金鑰格式不對。API 會改用規則備援；CLI 對話模式會停下來說明。"""


def _env(key: str, min_len: int) -> str:
    v = (os.environ.get(key) or "").strip()
    if v in PLACEHOLDERS or len(v) < min_len:
        raise LLMNotConfigured(f".env 裡的 {key} 沒有設定或格式不對（不會用預設金鑰）。請看 README「設定金鑰」。")
    return v


def build_llms(timeout: float = 60):
    """回傳（回答 LLM, 驗證 LLM, (模型名稱, 驗證模型名稱)）。沒有金鑰時丟出 LLMNotConfigured。"""
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    base = os.environ.get("LLM_BASE_URL", "").strip()
    if not base:
        base = f"https://api.cloudflare.com/client/v4/accounts/{_env('CF_ACCOUNT_ID', 20)}/ai/v1"
    token = _env("LLM_API_KEY", 20)
    model = os.environ.get("LLM_MODEL", DEFAULT_MODEL)
    vmodel = os.environ.get("VERIFIER_MODEL", DEFAULT_VERIFIER)
    return (OpenAICompatLLM(base, token, model, timeout=timeout),
            OpenAICompatLLM(base, token, vmodel, max_tokens=800, timeout=timeout), (model, vmodel))
