"""AI顧問阿國命令列（在 jiujujia-agent/ 執行）。

    python -m aguo chat --user chen --detail     對話模式（二階 v1.3 的三個 MCP Server＋三道檢查，需要 .env）
    python -m aguo ask assess evals/assess_cases.json --case lin   執行一項能力，印出 JSON
    python -m aguo export --demo                 產生二階 /v2/ 預先結果（接法 C）
    python -m aguo serve --port 8710             啟動 HTTP API（POST /v1/<capability>）
    python -m aguo capabilities                  列出能力與實作狀態
    python -m aguo schemas --out aguo/schemas    輸出各能力的 JSON Schema

沒有 .env 時，ask、export、serve 會用規則備援（fallback: true）；chat 一定要有金鑰。
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from aguo import pipeline  # noqa: E402
from aguo.llm import LLMNotConfigured, build_llms  # noqa: E402

MODE = {"verified": "✔ 通過三道檢查", "rewritten": "✔ 第一次沒過，重寫後通過", "fallback": "⚠ 檢查沒過，改用系統固定版本"}
CASES = ROOT / "evals" / "assess_cases.json"


def _llms(rules_only: bool):
    if rules_only:
        return None, None, None
    try:
        llm, vllm, (model, _) = build_llms(timeout=8)
        return llm, vllm, model
    except LLMNotConfigured as e:
        print(f"[AI顧問阿國] {e} 這次改用規則結果（fallback: true）。", file=sys.stderr)
        return None, None, None


async def _confirm(desc: str) -> bool:
    if not sys.stdin.isatty():
        print(f"[確認] {desc} → 沒有終端機可以詢問，預設拒絕")
        return False
    ans = await asyncio.to_thread(input, f"\n[確認] 阿國要{desc}。要執行嗎？[y/N] ")
    return ans.strip().lower() in ("y", "yes")


async def chat(user: str, show: bool) -> None:
    from aguo.agent import Agent
    try:
        llm, vllm, (m1, m2) = build_llms()
    except LLMNotConfigured as e:
        sys.exit(f"[AI顧問阿國] {e}")
    async with Agent(user, llm, vllm, _confirm) as agent:
        print(f"AI顧問阿國｜已登入：{agent.ctx['name']}｜回答模型 {m1}｜驗證模型 {m2}\n輸入問題，或輸入 exit 離開。")
        while True:
            q = (await asyncio.to_thread(input, "\n你：")).strip()
            if q.lower() in ("exit", "quit", "離開"):
                break
            if not q:
                continue
            r = await agent.ask(q)
            print(f"\n阿國：{r.answer}\n—— {MODE[r.mode]}" + ("｜⚠ 資料中有疑似指令，已攔下" if r.flagged_injection else ""))
            if show:
                for c in r.checks:
                    print(f"   {'✔' if c.passed else '✘'} {c.name}" + (f"：{'；'.join(c.issues)}" if c.issues else ""))
                for t in r.tool_calls:
                    print(f"   · {t}")


def _load_case(path: str, case: str | None) -> dict:
    data = json.loads((sys.stdin.read() if path == "-" else Path(path).read_text("utf-8")))
    if "cases" in data:
        found = [c for c in data["cases"] if c["id"] == case] if case else data["cases"][:1]
        if not found:
            sys.exit(f"找不到案例 {case}，可用：{'、'.join(c['id'] for c in data['cases'])}")
        return found[0]["input"]
    return data


async def ask(capability: str, path: str, case: str | None, rules_only: bool) -> int:
    llm, vllm, model = _llms(rules_only)
    try:
        r = await pipeline.run(capability, _load_case(path, case), llm, vllm, model)
    except pipeline.InputError as e:
        print(json.dumps({"error": "輸入格式不正確", "details": e.details}, ensure_ascii=False, indent=1))
        return 2
    except (pipeline.CapabilityNotFound, pipeline.CapabilityNotImplemented) as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False))
        return 2
    print(json.dumps(r, ensure_ascii=False, indent=1))
    return 0


async def export(out: Path, rules_only: bool) -> int:
    """二階 /v2/ 接法 C：把示範案例的阿國結果存成 JSON，原型平常讀這些檔，企業 Demo 時再切換即時連線。"""
    llm, vllm, model = _llms(rules_only)
    out.mkdir(parents=True, exist_ok=True)
    index = []
    for c in json.loads(CASES.read_text("utf-8"))["cases"]:
        if not c.get("demo"):
            continue
        r = await pipeline.run("assess", c["input"], llm, vllm, model)
        f = out / f"assess_{c['id']}.json"
        f.write_text(json.dumps({"case": c["id"], "title": c["title"], **r}, ensure_ascii=False, indent=1), "utf-8")
        index.append({"case": c["id"], "title": c["title"], "capability": "assess", "file": f.name,
                      "fallback": r["fallback"]})
    (out / "index.json").write_text(json.dumps({"generated_at": datetime.now().isoformat(timespec="seconds"),
                                                "label": pipeline.LABEL, "results": index},
                                               ensure_ascii=False, indent=1), "utf-8")
    print(f"[OK] 已產生 {len(index)} 份預先結果到 {out}（{'規則備援' if llm is None else '經 LLM 與三道檢查'}）")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m aguo", description="AI顧問阿國")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("chat", help="對話模式（需要 .env）")
    c.add_argument("--user", default="chen", help="chen 陳小姐｜wang 王小明（生活顧問）｜chent 陳技師｜li_f 李小姐｜zhang 張經理")
    c.add_argument("--detail", action="store_true", help="顯示每道檢查與工具呼叫")
    a = sub.add_parser("ask", help="執行一項能力")
    a.add_argument("capability")
    a.add_argument("input", help="JSON 檔路徑，或 - 代表從標準輸入讀")
    a.add_argument("--case", help="輸入檔有多個案例時，指定案例 id")
    a.add_argument("--rules-only", action="store_true", help="不呼叫 LLM，只用規則")
    e = sub.add_parser("export", help="產生二階 /v2/ 預先結果")
    e.add_argument("--demo", action="store_true", required=True)
    e.add_argument("--out", type=Path, default=ROOT / "exports" / "demo")
    e.add_argument("--rules-only", action="store_true")
    s = sub.add_parser("serve", help="啟動 HTTP API")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8710)
    sub.add_parser("capabilities", help="列出能力")
    sc = sub.add_parser("schemas", help="輸出 JSON Schema")
    sc.add_argument("--out", type=Path, default=ROOT / "aguo" / "schemas")
    args = ap.parse_args(argv)

    if args.cmd == "chat":
        asyncio.run(chat(args.user, args.detail))
        return 0
    if args.cmd == "ask":
        return asyncio.run(ask(args.capability, args.input, args.case, args.rules_only))
    if args.cmd == "export":
        return asyncio.run(export(args.out, args.rules_only))
    if args.cmd == "serve":
        import uvicorn

        from aguo.api import create_app
        uvicorn.run(create_app(), host=args.host, port=args.port)
        return 0
    if args.cmd == "capabilities":
        for d in pipeline.describe():
            print(f"{'✔' if d['implemented'] else '…'} {d['endpoint']:<26} {d['title']}（#{d['issue']}）")
        return 0
    if args.cmd == "schemas":
        args.out.mkdir(parents=True, exist_ok=True)
        for name, sch in pipeline.schemas().items():
            (args.out / f"{name}.schema.json").write_text(json.dumps(sch, ensure_ascii=False, indent=1), "utf-8")
        print(f"[OK] 已輸出 {len(pipeline.schemas())} 份 JSON Schema 到 {args.out}")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
