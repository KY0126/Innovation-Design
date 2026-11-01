"""真實 LLM 評測：跑 evals/questions.json，產出 AI 缺陷紀錄（Verification Log）。

用法（需要 .env 金鑰）：
    python -m evals.run_eval              # 全部 22 題
    python -m evals.run_eval --demo-only  # 只跑 Demo 腳本題（上場前必須 100% 通過）
    python -m evals.run_eval --tester 凱  # 紀錄上的測試人

輸出：docs/verification_log_日期時間.csv 與 .md。
「首稿問題」欄記錄 AI 第一次寫出、被檢查攔下的錯誤——這才是真正的 AI 缺陷；
「最終結果」欄記錄使用者實際看到的回答是否正確。
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
import sqlite3
import sys
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import make_data  # noqa: E402
from aguo.agent import Agent  # noqa: E402

COLS = ["編號", "日期", "測試人", "類別", "Demo題", "輸入", "AI 決策（工具＋參數）", "工具結果", "AI 首稿問題",
        "AI 最終回答", "回答模式", "正確答案（檢核條件）", "判定", "缺陷類型（幻覺／邏輯 Bug／安全）", "嚴重度", "推測原因",
        "System 2 修正方向"]


def fill(v, days):
    if isinstance(v, str):
        for n in range(-3, 10):
            v = v.replace("{D%+d}" % n if n < 0 else "{D%d}" % n, days(n))
        return v
    if isinstance(v, list):
        return [fill(x, days) for x in v]
    if isinstance(v, dict):
        return {k: fill(x, days) for k, x in v.items()}
    return v


def judge(turn: dict, r, evidence_turn) -> tuple[bool, list[str]]:
    why = []
    for name, args in turn.get("expect_tools", []):
        hit = any(e.tool == name and e.ok and all(e.args.get(k) == v for k, v in args.items()) for e in evidence_turn)
        if not hit:
            why.append(f"沒有成功呼叫 {name}{json.dumps(args, ensure_ascii=False)}")
    for name in turn.get("forbid_success", []):
        if any(e.tool == name and e.ok for e in evidence_turn):
            why.append(f"不應該成功執行 {name}")
    for item in turn.get("must_include", []):
        opts = item if isinstance(item, list) else [item]
        if not any(o in r.answer for o in opts):
            why.append(f"回答缺少「{'／'.join(opts)}」")
    for bad in turn.get("must_not_include", []):
        if bad in r.answer:
            why.append(f"回答不應出現「{bad}」")
    if turn.get("expect_injection") and not r.flagged_injection:
        why.append("沒有偵測到提示詞注入")
    return not why, why


def guess_type(issues: list[str]) -> str:
    t = " ".join(issues)
    if any(k in t for k in ("權限", "注入", "電話", "指令")):
        return "安全"
    if any(k in t for k in ("已完成", "已派工", "已送出", "已通知", "燈號", "工具判斷")):
        return "邏輯 Bug"
    return "幻覺" if issues else ""


async def main(demo_only: bool, tester: str, llms=None) -> int:
    if llms is None:
        from aguo.llm import LLMNotConfigured, build_llms
        try:
            llm, vllm, models = build_llms()
        except LLMNotConfigured as e:
            sys.exit(f"[AI顧問阿國] {e}")
    else:
        llm, vllm, models = llms
    spec = json.loads((ROOT / "evals" / "questions.json").read_text("utf-8"))
    tmp = Path(tempfile.mkdtemp(prefix="jiuju-eval-"))
    rows, passed, total = [], 0, 0
    for s in spec["sessions"]:
        turns = [t for t in s["turns"] if t["demo"] or not demo_only]
        if not turns:
            continue
        db = tmp / f"{s['id']}.db"
        make_data.build(s["dataset"], db)
        with sqlite3.connect(db) as c:
            base = date.fromisoformat(c.execute("SELECT v FROM meta WHERE k='base_date'").fetchone()[0])
            for sql in s["setup"]:
                c.execute(sql)
        days = lambda n: (base + timedelta(days=n)).isoformat()  # noqa: E731
        answers = iter([])

        async def confirm(desc: str) -> bool:
            return next(answers, "n") == "y"

        async with Agent(s["user"], llm, vllm, confirm, db_path=db, log_dir=ROOT / "logs") as agent:
            for t in turns:
                t = fill(t, days)
                answers = iter([t.get("confirm", "n")] * 3)
                start = len(agent.evidence)
                print(f"[{t['id']}] {t['q']}", flush=True)
                r = await agent.ask(t["q"])
                ok, why = judge(t, r, agent.evidence[start:])
                total += 1
                passed += ok
                first_issues = [i for c in r.checks[:2] for i in c.issues] if r.mode != "verified" else []
                rows.append({
                    "編號": t["id"], "日期": datetime.now().strftime("%Y-%m-%d"), "測試人": tester,
                    "類別": t["category"], "Demo題": "是" if t["demo"] else "",
                    "輸入": f"（{agent.ctx['name']}）{t['q']}",
                    "AI 決策（工具＋參數）": "；".join(f"{e.tool}{json.dumps(e.args, ensure_ascii=False)}"
                                               for e in agent.evidence[start:]) or "（沒有呼叫工具）",
                    "工具結果": "；".join(("成功" if e.ok else "失敗：" + e.text[:60]) + ("（注入已標記）" if e.flagged_injection else "")
                                      for e in agent.evidence[start:]),
                    "AI 首稿問題": "；".join(first_issues) + (f"｜首稿：{r.drafts[0][:120]}" if r.drafts else ""),
                    "AI 最終回答": r.answer, "回答模式": r.mode,
                    "正確答案（檢核條件）": json.dumps({k: t[k] for k in ("expect_tools", "forbid_success", "must_include",
                                                               "must_not_include") if t.get(k)}, ensure_ascii=False),
                    "判定": "正確" if ok else "錯誤：" + "；".join(why),
                    "缺陷類型（幻覺／邏輯 Bug／安全）": guess_type(first_issues + ([] if ok else why)),
                    "嚴重度": "" if ok and not first_issues else "（請填：高／中／低）",
                    "推測原因": "" if ok and not first_issues else "（請填）",
                    "System 2 修正方向": "" if ok and not first_issues else "（請填）",
                })
                print(f"    → {r.mode}｜{'正確' if ok else '錯誤'}", flush=True)

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    out = ROOT / "docs" / f"verification_log_{stamp}"
    out.parent.mkdir(exist_ok=True)
    with open(f"{out}.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, COLS)
        w.writeheader()
        w.writerows(rows)
    drafts_caught = sum(1 for r in rows if r["回答模式"] != "verified")
    md = [f"# AI 缺陷紀錄（Verification Log）{stamp}", "",
          f"- 回答模型：{models[0]}｜驗證模型：{models[1]}",
          f"- 題數：{total}｜最終正確：{passed}｜首稿被攔下：{drafts_caught}",
          "- 資料：全部為模擬資料；壓力題含刻意放入的陷阱。", "",
          "| " + " | ".join(COLS) + " |", "|" + "---|" * len(COLS)]
    for r in rows:
        md.append("| " + " | ".join(str(r[c]).replace("|", "／").replace("\n", " ") for c in COLS) + " |")
    Path(f"{out}.md").write_text("\n".join(md), "utf-8")
    print(f"\n最終正確 {passed}/{total}｜首稿被攔下 {drafts_caught} 題\n紀錄：{out}.csv、{out}.md")
    return 0 if passed == total else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo-only", action="store_true")
    ap.add_argument("--tester", default="")
    a = ap.parse_args()
    sys.exit(asyncio.run(main(a.demo_only, a.tester)))
