"""AI顧問阿國 HTTP API：POST /v1/<capability>（ARCHITECTURE.md §7.1）。

    GET  /v1/health         服務狀態（有沒有設定 LLM）
    GET  /v1/capabilities   能力清單與實作狀態
    POST /v1/<capability>   執行一項能力；回應一律附 checks 與 fallback

錯誤：400 不是 JSON｜404 沒有這項能力｜422 輸入格式不對（字串 "76"、"False" 會被拒絕）｜501 能力尚未實作。
沒有 .env 或 LLM 連不上時回規則備援（fallback: true），服務不中斷。
啟動：python -m aguo serve（只在本機或伺服器端呼叫，金鑰不放網頁）。
"""
from __future__ import annotations

import json

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from aguo import pipeline
from aguo.llm import LLMNotConfigured, build_llms


def _json(data, status: int = 200) -> JSONResponse:
    return JSONResponse(data, status_code=status, media_type="application/json; charset=utf-8")


def create_app(llm=None, vllm=None, model: str | None = None, use_env: bool = True) -> Starlette:
    """llm／vllm 可注入（測試用模擬 LLM）；沒有注入且 use_env 為 True 時讀 .env。"""
    state = {"llm": llm, "vllm": vllm, "model": model, "llm_error": None}
    if llm is None and use_env:
        try:
            state["llm"], state["vllm"], (state["model"], _) = build_llms(timeout=8)
        except LLMNotConfigured as e:
            state["llm_error"] = str(e)

    async def health(_: Request):
        return _json({"name": "AI顧問阿國", "version": pipeline.VERSION, "llm_configured": state["llm"] is not None,
                      "note": state["llm_error"] or "ok"})

    async def capabilities(_: Request):
        return _json({"capabilities": pipeline.describe()})

    async def call(request: Request):
        name = request.path_params["capability"]
        try:
            payload = json.loads(await request.body() or b"null")
        except (json.JSONDecodeError, UnicodeDecodeError):
            return _json({"error": "請求內容不是正確的 JSON"}, 400)
        try:
            result = await pipeline.run(name, payload, state["llm"], state["vllm"], state["model"])
        except pipeline.CapabilityNotFound:
            return _json({"error": f"沒有「{name}」這項能力", "capabilities": [c["capability"] for c in pipeline.describe()]}, 404)
        except pipeline.CapabilityNotImplemented as e:
            return _json({"error": f"「{name}」還沒實作", "issue": e.issue}, 501)
        except pipeline.InputError as e:
            return _json({"error": "輸入格式不正確", "details": e.details}, 422)
        return _json(result)

    return Starlette(routes=[Route("/v1/health", health), Route("/v1/capabilities", capabilities),
                             Route("/v1/{capability}", call, methods=["POST"])])
