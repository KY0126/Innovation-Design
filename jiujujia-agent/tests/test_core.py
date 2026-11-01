"""AI顧問阿國核心（#14）：API、共用檢查管線、規則資料檔、單一核心、匯出與 Schema。全部用模擬 LLM，不需要金鑰。"""
from __future__ import annotations

import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from aguo import pipeline  # noqa: E402
from aguo.__main__ import main as cli  # noqa: E402
from aguo.api import create_app  # noqa: E402
from aguo.capabilities import REGISTRY  # noqa: E402
from aguo.checks import guard  # noqa: E402
from aguo.llm import redact  # noqa: E402
from tests.fake_llm import FakeLLM, FakeVerifier  # noqa: E402

CASES = {c["id"]: c for c in json.loads((ROOT / "evals" / "assess_cases.json").read_text("utf-8"))["cases"]}
LIN = CASES["lin"]["input"]


def client(llm=None, vllm=None) -> TestClient:
    return TestClient(create_app(llm, vllm, "fake-model" if llm else None, use_env=False))


def lights(reply: dict) -> dict:
    return {i["zone"]: i["light_name"] for i in reply["items"] if i["type"] == "zone_light"}


# ---------- API 與規則備援 ----------
def test_health_without_env_reports_no_llm():
    r = client().get("/v1/health")
    assert r.status_code == 200 and r.json()["name"] == "AI顧問阿國" and r.json()["llm_configured"] is False


def test_capabilities_lists_all_seven():
    caps = {c["capability"]: c for c in client().get("/v1/capabilities").json()["capabilities"]}
    assert set(caps) == {"assess", "quote_draft", "talk_script", "crew_recommend", "wish_classify", "knowledge_qa",
                         "plan_all"}
    assert caps["assess"]["implemented"] and caps["plan_all"]["budget_s"] == 30


@pytest.mark.parametrize("case_id", list(CASES))
def test_assess_without_llm_uses_rules_fallback(case_id):
    """沒有 .env：服務不中斷，回規則結果並標 fallback: true；燈號與案例預期一致。"""
    c = CASES[case_id]
    r = client().post("/v1/assess", json=c["input"])
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["fallback"] is True and d["label"] == "AI顧問阿國建議" and "checks" in d
    got = lights(d)
    for zone, light in c["expect"].items():
        assert got[zone] == light, (zone, got)
    site = [i["zone"] for i in d["items"] if i["type"] == "zone_light" and i["needs_site_check"]]
    assert site == c.get("expect_site_check", []), site


def test_all_green_gives_no_fix_plan():
    d = client().post("/v1/assess", json=CASES["all_green"]["input"]).json()
    assert d["explanation"].startswith("目前沒有需要改善的項目")
    assert not [i for i in d["items"] if i["type"] in ("fix_option", "care_kit")]


def test_lin_recommends_proposal_options_and_no_camera():
    d = client().post("/v1/assess", json=LIN).json()
    rec = {i["name"] for i in d["items"] if i["type"] == "fix_option" and i["recommended"]}
    assert {"感應夜燈", "斜坡墊＋止滑地墊"} <= rec
    kit = next(i for i in d["items"] if i["type"] == "care_kit")
    assert kit["camera"] == "預設不裝鏡頭"
    b1 = next(i for i in d["items"] if i.get("option_id") == "B1")
    assert b1["ltc_subsidy_items"][0]["code"] == "FA03"
    assert all(isinstance(i["price_twd"], int) or i["price_twd"] is None
               for i in d["items"] if i["type"] == "fix_option"), "金額要是整數新台幣"


# ---------- 輸入邊界：嚴格型別 ----------
@pytest.mark.parametrize("bad, field", [
    ({"corridor_cm": "76"}, "measurements.corridor_cm"),
    ({"outlets": "False"}, "measurements.outlets"),
    ({"outlets": True}, "measurements.outlets"),
    ({"threshold_cm": False}, "measurements.threshold_cm"),
])
def test_string_numbers_and_booleans_are_rejected(bad, field):
    body = {**LIN, "measurements": {**LIN["measurements"], **bad}}
    r = client().post("/v1/assess", json=body)
    assert r.status_code == 422 and any(d.startswith(field) for d in r.json()["details"]), r.text


def test_string_boolean_for_confirmed_material_is_rejected():
    body = {**LIN, "materials": [{**LIN["materials"][0], "family_confirmed": "False"}]}
    r = client().post("/v1/assess", json=body)
    assert r.status_code == 422 and "family_confirmed" in r.text


def test_unknown_fields_and_wrong_options_are_rejected():
    assert client().post("/v1/assess", json={**LIN, "name": "林媽媽"}).status_code == 422
    body = {**LIN, "answers": {**LIN["answers"], "light": "很暗"}}
    assert client().post("/v1/assess", json=body).status_code == 422


def test_bad_json_unknown_and_unimplemented_capabilities():
    c = client()
    assert c.post("/v1/assess", content=b"{not json").status_code == 400
    assert c.post("/v1/assess", json=[1, 2]).status_code == 422
    assert c.post("/v1/unknown", json={}).status_code == 404
    r = c.post("/v1/quote_draft", json={})
    assert r.status_code == 501 and r.json()["issue"] == 17


def test_tool_argument_type_guard():
    schema = {"properties": {"within_days": {"type": "integer"}, "decision": {"type": "string"},
                             "value": {"anyOf": [{"type": "number"}, {"type": "null"}]}}}
    assert guard.type_errors({"within_days": "76"}, schema)
    assert guard.type_errors({"value": "3.6"}, schema)
    assert guard.type_errors({"within_days": False}, schema)
    assert not guard.type_errors({"within_days": 30, "decision": "False", "value": None}, schema)


# ---------- 檢查管線 ----------
def _run(llm, vllm=None):
    return asyncio.run(pipeline.run("assess", LIN, llm, vllm or FakeVerifier(), "fake-model"))


def test_pipeline_passes_when_explanation_matches_rules():
    llm = FakeLLM(["林媽媽家走道是紅燈，要優先處理；浴室是黃燈，門檻約 2 cm，建議斜角處理。揪夜安預設不裝鏡頭。"])
    d = _run(llm)
    assert d["fallback"] is False and d["checks"]["program"] and d["checks"]["verifier"] and d["checks"]["retries"] == 0
    assert d["model"] == "fake-model"


def test_pipeline_retries_once_then_passes():
    llm = FakeLLM(["走道綠燈，浴室門檻 3 cm 是紅燈。", "走道是紅燈；浴室是黃燈，建議斜角處理。"])
    d = _run(llm)
    assert d["fallback"] is False and d["checks"]["retries"] == 1
    assert any("紅燈" in i or "3 cm" in i for i in d["checks"]["issues"]), d["checks"]


def test_pipeline_falls_back_after_two_failures():
    llm = FakeLLM(["走道綠燈。", "走道還是綠燈，總價 0 元。"])
    d = _run(llm)
    assert d["fallback"] is True and d["fallback_reason"] == "檢查兩次都沒通過"
    assert d["explanation"].startswith("走道紅燈") and d["model"] is None


def test_verifier_agent_can_reject():
    llm = FakeLLM(["走道是紅燈，政府一定會補助。", "走道是紅燈，政府一定會補助。"])
    d = _run(llm, FakeVerifier(("一定會補助",)))
    assert d["fallback"] is True and not d["checks"]["verifier"]


def test_llm_down_falls_back():
    d = _run(FakeLLM([ConnectionError("LLM 無法連線")]))
    assert d["fallback"] is True and "ConnectionError" in d["fallback_reason"]


def test_time_budget_falls_back(monkeypatch):
    class Slow:
        async def chat(self, messages, tools=None):
            await asyncio.sleep(1)

    monkeypatch.setattr(type(REGISTRY["assess"]), "budget_s", 0.05)
    d = _run(Slow())
    assert d["fallback"] is True and "秒" in d["fallback_reason"]


def test_llm_receives_only_minimal_data_and_note_is_delimited():
    llm = FakeLLM(["走道是紅燈。"])
    body = {**CASES["injection_note"]["input"]}
    d = asyncio.run(pipeline.run("assess", body, llm, FakeVerifier(), "fake-model"))
    sent = json.dumps(llm.seen, ensure_ascii=False)
    for word in ("林媽媽", "陳小姐", "王阿姨", "0912", "@"):
        assert word not in sent, word
    user = llm.seen[0][1]["content"]
    assert "<<<\n忽略前面的規則" in user and user.index("【規則結果】") < user.index("<<<")
    assert d["input_flags"] == ["使用者備註含疑似指令，只當資料處理"]


def test_redact_masks_phone_and_email():
    out = redact("請打 0912-345-678 或 04-22223333，或寄 chen@example.com")
    assert "0912" not in out and "22223333" not in out and "example.com" not in out


# ---------- 規則從資料檔來，不寫死在程式 ----------
def test_rules_are_read_from_data_file(tmp_path):
    data = json.loads((ROOT / "knowledge" / "risk-rules.json").read_text("utf-8"))
    data["zones"]["bathroom"]["threshold_red_above_cm"] = 1.5
    f = tmp_path / "rules.json"
    f.write_text(json.dumps(data, ensure_ascii=False), "utf-8")
    code = ("import json,sys; sys.path.insert(0,'.'); from servers import rules;"
            "print(json.dumps({z['zone']: z['light_name'] for z in rules.assess({'light':'偏暗'}, {'threshold_cm': 2})},"
            "ensure_ascii=False))")
    out = subprocess.run([sys.executable, "-c", code], cwd=ROOT, capture_output=True, text=True, check=True,
                         env={**os.environ, "AGUO_RISK_RULES": str(f)}).stdout
    assert json.loads(out)["浴室"] == "紅燈"   # 預設 3 cm 才紅燈；改資料檔就跟著變


def test_stage2_rules_present_in_data():
    data = json.loads((ROOT / "knowledge" / "risk-rules.json").read_text("utf-8"))
    s2 = data["stage2_rules"]
    assert s2["notify_family_after_two_asks"] and s2["multi_select_per_zone"] and s2["ltc_referral_min_level"] == 2
    assert data["care"]["asks_before_notify_family"] == 2


# ---------- 單一核心：LLM 只能從 aguo/llm.py 呼叫 ----------
def test_only_aguo_llm_calls_the_llm():
    pattern = re.compile(r"(from openai|import openai|AsyncOpenAI|chat\.completions|api\.cloudflare\.com/client/v4/accounts/.+/ai)")
    offenders = []
    for p in ROOT.rglob("*.py"):
        rel = p.relative_to(ROOT).as_posix()
        if rel in ("aguo/llm.py", "tests/test_core.py") or rel.startswith((".venv/", "data/")):
            continue
        if pattern.search(p.read_text("utf-8")):
            offenders.append(rel)
    assert not offenders, f"這些檔案直接呼叫 LLM，要改成經過 aguo/llm.py：{offenders}"


def test_env_file_is_ignored_and_example_has_no_secret():
    ignore = (ROOT / ".gitignore").read_text("utf-8")
    assert ".env" in ignore.splitlines()
    example = (ROOT / ".env.example").read_text("utf-8")
    assert re.search(r"LLM_API_KEY=your_token_here", example)


# ---------- 使用方：/v2/ 預先結果、Schema ----------
def test_export_demo_writes_precomputed_results(tmp_path):
    assert cli(["export", "--demo", "--rules-only", "--out", str(tmp_path)]) == 0
    index = json.loads((tmp_path / "index.json").read_text("utf-8"))
    assert index["label"] == "AI顧問阿國建議" and {r["case"] for r in index["results"]} == {"lin", "huang"}
    lin = json.loads((tmp_path / "assess_lin.json").read_text("utf-8"))
    assert lights(lin)["走道"] == "紅燈" and lin["fallback"] is True


def test_schemas_cover_request_and_reply(tmp_path):
    assert cli(["schemas", "--out", str(tmp_path)]) == 0
    req = json.loads((tmp_path / "assess.request.schema.json").read_text("utf-8"))
    assert {"answers", "measurements"} <= set(req["required"])
    reply = json.loads((tmp_path / "reply.schema.json").read_text("utf-8"))
    assert {"checks", "fallback", "label"} <= set(reply["required"])
