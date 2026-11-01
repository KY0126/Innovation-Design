"""模擬LLM：不需要金鑰，照腳本回傳工具呼叫與回答，用來測試整條流程與三道檢查。

注意：這裡測的是「系統會不會擋住錯誤」，不是真實 LLM 的表現；真實 LLM 要用 python -m evals.run_eval。
"""
from __future__ import annotations

import json
import uuid
from typing import Callable

from aguo.llm import LLMReply, ToolCall


class FakeLLM:
    """steps：依序回傳。每一步是 [("tool_name", {args}), ...]（呼叫工具）或 str / callable(msgs)->str（回答）。
    也可以是 Exception 實例，模擬連線失敗。"""

    def __init__(self, steps: list):
        self.steps = list(steps)
        self.seen: list[list[dict]] = []

    async def chat(self, messages: list[dict], tools=None) -> LLMReply:
        self.seen.append(messages)
        if not self.steps:
            return LLMReply(content="（腳本已結束）")
        s = self.steps.pop(0)
        if isinstance(s, Exception):
            raise s
        if isinstance(s, list):
            return LLMReply(tool_calls=[ToolCall(f"f-{uuid.uuid4().hex[:6]}", n, a) for n, a in s])
        return LLMReply(content=s(messages) if callable(s) else s)


class FakeVerifier:
    """預設通過；回答含有 bad_phrases 任一詞就判定不通過。raw 可直接指定輸出（測無法解析的情況）。"""

    def __init__(self, bad_phrases: tuple[str, ...] = (), raw: str | None = None):
        self.bad = bad_phrases
        self.raw = raw
        self.calls = 0

    async def chat(self, messages: list[dict], tools=None) -> LLMReply:
        self.calls += 1
        if self.raw is not None:
            return LLMReply(content=self.raw)
        answer = messages[-1]["content"].split("【回答】", 1)[-1]
        hits = [p for p in self.bad if p in answer]
        if hits:
            return LLMReply(content=json.dumps({"pass": False, "issues": [
                {"sentence": h, "problem": "工具結果沒有這個內容"} for h in hits]}, ensure_ascii=False))
        return LLMReply(content='{"pass": true, "issues": []}')


def last_tool_json(messages: list[dict], tool_index: int = -1) -> dict:
    """從對話中取出最後一個工具結果（給腳本組回答用）。"""
    tools = [m for m in messages if m.get("role") == "tool"]
    text = tools[tool_index]["content"]
    text = text.split("\n", 1)[1] if text.startswith("[安全守門]") else text
    return json.loads(text)


def say(fn: Callable[[list[dict]], str]) -> Callable[[list[dict]], str]:
    return fn
