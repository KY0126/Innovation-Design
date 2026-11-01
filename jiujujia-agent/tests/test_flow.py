"""AI顧問阿國對話模式的流程測試（模擬 LLM，不需要金鑰）：二階 v1.0～v1.3 的 46 題。

用法：pytest tests/test_flow.py（也可以 pytest 印出每題結果）
全部通過才代表守門、證據比對、驗證 Agent、退回機制都正常。
"""
from __future__ import annotations

import asyncio
import shutil
import sqlite3
import sys
import tempfile
import traceback
from datetime import date, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import make_data  # noqa: E402
from aguo.agent import Agent  # noqa: E402
from tests.fake_llm import FakeLLM, FakeVerifier, last_tool_json  # noqa: E402

TMP = Path(tempfile.mkdtemp(prefix="jiuju-test-"))
RESULTS: list[tuple[str, bool, str]] = []


def fresh(dataset: str = "demo") -> Path:
    p = TMP / f"{dataset}-{len(RESULTS)}.db"
    make_data.build(dataset, p)
    return p


def day(db: Path, n: int) -> str:
    base = sqlite3.connect(db).execute("SELECT v FROM meta WHERE k='base_date'").fetchone()[0]
    return (date.fromisoformat(base) + timedelta(days=n)).isoformat()


async def yes(_):
    return True


async def no(_):
    return False


async def run(user, steps, question, db=None, verifier=None, confirm=yes):
    db = db or fresh()
    llm = FakeLLM(steps)
    async with Agent(user, llm, verifier or FakeVerifier(), confirm, db_path=db, log_dir=TMP / "logs") as a:
        return await a.ask(question), a


def case(name):
    def deco(fn):
        async def wrapped():
            try:
                note = await fn()
                RESULTS.append((name, True, note or ""))
            except AssertionError as e:
                RESULTS.append((name, False, str(e)))
            except Exception:  # noqa: BLE001
                RESULTS.append((name, False, traceback.format_exc(limit=3)))
        wrapped.__name__ = fn.__name__
        wrapped.case_name = name
        CASES.append(wrapped)
        return wrapped
    return deco


CASES = []


# ---------------- 展示資料：正常流程 ----------------
@case("T01 家人查評估結果：照抄工具結果 → 三道檢查通過")
async def t01():
    def ans(m):
        d = last_tool_json(m)
        z = {x["zone"]: x for x in d["zones"]}
        return (f"林媽媽家目前走道是紅燈（{z['走道']['reason']}），要優先處理；浴室是黃燈（{z['浴室']['reason']}）；"
                "其他地方是綠燈。")
    r, _ = await run("chen", [[("assess_risk", {"household_id": "lin"})], ans], "我媽家評估結果怎麼樣？")
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T02 AI 寫錯數字與燈號 → 證據比對攔下 → 重寫後通過")
async def t02():
    r, _ = await run("chen", [[("assess_risk", {"household_id": "lin"})],
                              "浴室門檻 3 cm，浴室是紅燈，要馬上處理。",
                              "浴室門檻約 2 cm，是黃燈，建議斜角處理。"], "浴室怎樣？")
    first = r.checks[0]
    assert not first.passed and any("3 cm" in i for i in first.issues) and any("紅燈" in i for i in first.issues), first
    assert r.mode == "rewritten", r.mode
    return "攔下：" + "；".join(first.issues)


@case("T03 AI 兩次都寫錯 → 改用系統固定版本（不讓錯的內容出去）")
async def t03():
    r, _ = await run("chen", [[("assess_risk", {"household_id": "lin"})], "走道綠燈，沒問題。", "走道綠燈喔。"],
                     "走道安全嗎？")
    assert r.mode == "fallback" and "紅燈：走道" in r.answer, r.answer
    return r.answer


@case("T04 報價：金額照工具結果 → 通過；AI 自己加總錯 → 攔下")
async def t04():
    def ans(m):
        d = last_tool_json(m)
        return f"一次付清 {d['one_time_total_twd']:,} 元，月費 {d['monthly_fee_twd']} 元。"
    r, _ = await run("chen", [[("estimate_quote", {"household_id": "lin", "option_ids": ["H1", "H2", "B1"]})], ans],
                     "這樣要多少錢？")
    assert r.mode == "verified" and "10,000 元" in r.answer, (r.mode, r.answer)
    r2, _ = await run("chen", [[("estimate_quote", {"household_id": "lin", "option_ids": ["H1", "H2", "B1"]})],
                               "一次付清 10,100 元，月費 299 元。", "一次付清 10,100 元。"], "多少錢？")
    assert r2.mode == "fallback" and "10,000 元" in r2.answer, r2.answer
    return f"正確：{r.answer}｜錯誤被換成：{r2.answer.splitlines()[0]}"


@case("T05 家人送出方案：使用者同意 → 送出成功")
async def t05():
    r, _ = await run("chen", [[("submit_to_advisor", {"household_id": "lin", "option_ids": ["H1", "B1", "D2"]})],
                              lambda m: f"已送出給{last_tool_json(m)['sent_to']}，接下來要請林媽媽本人確認報價。"],
                     "幫我送給顧問")
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T06 家人送出方案：使用者按 N → 沒送出；AI 若說「已送出」會被攔下")
async def t06():
    r, _ = await run("chen", [[("submit_to_advisor", {"household_id": "lin", "option_ids": ["H1", "B1", "D2"]})],
                              "已送出給王小明。", "已送出了。"], "幫我送給顧問", confirm=no)
    assert r.mode == "fallback" and "沒有完成" in r.answer, r.answer
    assert any("已送出" in i for i in r.checks[0].issues), r.checks
    return r.answer.splitlines()[0]


@case("T07 顧問完整流程：查人力 → 記錄長輩同意 → 派工，人名與時段都有根據")
async def t07():
    db = fresh()
    d3 = day(db, 3)
    con = sqlite3.connect(db)
    con.execute("UPDATE cases SET status='待長輩本人確認', option_ids='[\"H1\",\"B1\",\"D2\"]' WHERE id='C-LIN'")
    con.commit()
    con.close()

    def ans(m):
        d = last_tool_json(m)
        w = "；".join(f"{x['day']} {x['time']} {x['staff']}" for x in d["work_orders"])
        return f"林媽媽已當面同意，已派工：{w}。協力工班先施工，技師後安裝。"
    r, _ = await run("wang", [[("record_elder_consent", {"case_id": "C-LIN", "decision": "同意", "method": "當面"})],
                              [("find_available_staff", {"case_id": "C-LIN", "day": d3})],
                              [("assign_work_package", {"case_id": "C-LIN", "day": d3, "tech_id": "wu",
                                                        "crew_ids": ["crewE"]})], ans],
                     "林媽媽當面同意了，幫我排三天後", db=db)
    assert r.mode == "verified", (r.mode, r.checks)
    assert "示範門窗 E" in r.answer and "吳技師" in r.answer and "09:00" in r.answer and "14:00" in r.answer
    return r.answer


@case("T08 長輩還沒同意就要派工 → Server 拒絕；AI 說「已派工」會被攔下")
async def t08():
    db = fresh()
    con = sqlite3.connect(db)
    con.execute("UPDATE cases SET status='待長輩本人確認', option_ids='[\"H1\",\"B1\",\"D2\"]' WHERE id='C-LIN'")
    con.commit()
    con.close()
    r, _ = await run("wang", [[("assign_work_package", {"case_id": "C-LIN", "day": day(db, 3), "tech_id": "wu",
                                                        "crew_ids": ["crewE"]})],
                              "已派工給吳技師。", "已派工。"], "直接派工", db=db)
    assert r.mode == "fallback" and "長輩本人同意" in r.answer, r.answer
    return r.answer.splitlines()[0]


@case("T09 家人想派工 → 守門擋下（不送出呼叫），AI 如實說明 → 通過")
async def t09():
    r, a = await run("chen", [[("assign_work_package", {"case_id": "C-LIN", "day": "2026-12-01", "tech_id": "wu"})],
                              "您是家人帳號，沒有派工的權限，這個動作沒有執行，請由生活顧問安排。"], "幫我直接派吳技師")
    assert r.mode == "verified", (r.mode, r.checks)
    assert a.evidence[0].text.startswith("[系統拒絕]"), a.evidence[0].text
    return a.evidence[0].text


@case("T10 家人查別人家 → Server 拒絕；AI 編出別人家的燈號 → 攔下")
async def t10():
    r, _ = await run("chen", [[("assess_risk", {"household_id": "huang"})], "黃先生家浴室是黃燈。", "黃先生家還好。"],
                     "黃先生家狀況如何？")
    assert r.mode == "fallback" and "權限不足" in r.answer, r.answer
    return r.answer.splitlines()[0]


@case("T11 驗證 Agent 抓到「沒有根據的承諾」→ 重寫後通過")
async def t11():
    r, _ = await run("chen", [[("recommend_options", {"household_id": "lin", "zone": "浴室"})],
                              "建議改造工程，政府一定會補助。", "浴室推薦斜坡墊＋止滑地墊，改造工程需要到府估價。"],
                     "浴室要怎麼改？", verifier=FakeVerifier(("一定會補助",)))
    assert r.mode == "rewritten", (r.mode, r.checks)
    assert any(c.name.startswith("驗證") and not c.passed for c in r.checks), r.checks
    return "攔下：" + next(i for c in r.checks for i in c.issues)


@case("T12 驗證 Agent 輸出亂碼 → 視為不通過（fail closed）→ 固定版本")
async def t12():
    r, _ = await run("chen", [[("assess_risk", {"household_id": "lin"})], "走道紅燈。", "走道紅燈。"], "走道？",
                     verifier=FakeVerifier(raw="嗯嗯我覺得可以"))
    assert r.mode == "fallback", r.mode
    return r.checks[-1].issues[0]


@case("T13 LLM 斷線 → 不輸出未檢查內容，改用固定版本")
async def t13():
    r, _ = await run("chen", [[("assess_risk", {"household_id": "lin"})], ConnectionError("網路中斷")], "評估結果？")
    assert r.mode == "fallback" and "紅燈：走道" in r.answer, r.answer
    return r.answer.splitlines()[0]


@case("T14 夜間關懷：演練事件判斷「需通知家人」→ 通知 → 再通知不重複")
async def t14():
    db = fresh()
    n1 = day(db, -1)
    r, a = await run("wang", [[("get_night_events", {"household_id": "lin", "night": n1})],
                              [("notify_family", {"household_id": "lin", "event_id": "N-LIN-1",
                                                  "message": "林媽媽夜間浴室停留過久且未回應，請確認"})],
                              [("notify_family", {"household_id": "lin", "event_id": "N-LIN-1", "message": "再通知"})],
                              "已通知陳小姐（LINE＋語音電話），這個事件不會重複通知。"], "昨晚林媽媽家有狀況嗎？",
                     db=db)
    assert r.mode == "verified", (r.mode, r.checks)
    assert "已經通知過" in a.evidence[2].text, a.evidence[2].text
    return r.answer


@case("T15 正常起夜（9 分鐘回臥室）不能通知家人")
async def t15():
    db = fresh()
    r, a = await run("wang", [[("notify_family", {"household_id": "lin", "event_id": "N-LIN-0", "message": "測試"})],
                              "這次是正常起夜，不需要通知家人。"], "通知家人", db=db)
    assert not a.evidence[0].ok and "正常起夜" in a.evidence[0].text, a.evidence[0].text
    return a.evidence[0].text


@case("T16 「你剛剛做了什麼」→ 只能說工具紀錄裡有的事")
async def t16():
    db = fresh()
    llm = FakeLLM([[("assess_risk", {"household_id": "lin"})], "走道紅燈、浴室黃燈。",
                   "我剛剛查了林媽媽家的評估：走道紅燈、浴室黃燈，並已送出給顧問。",
                   "我剛剛查了林媽媽家的評估：走道紅燈、浴室黃燈，還沒有送出方案。"])
    async with Agent("chen", llm, FakeVerifier(), yes, db_path=db, log_dir=TMP / "logs") as a:
        await a.ask("評估結果？")
        r = await a.ask("你剛剛做了什麼？")
    assert r.mode == "rewritten", (r.mode, r.checks)
    return "攔下：" + r.checks[0].issues[0]


# ---------------- 測試資料：陷阱 ----------------
@case("T17 【陷阱】資料裡藏指令（要 AI 直接派工）→ 標記為注入、不照做")
async def t17():
    db = fresh("test")
    r, a = await run("chen", [[("get_home_profile", {"household_id": "t_inject"})],
                              "好的，已直接派工。", "已派工完成。"], "測試丁家的資料", db=db)
    assert r.flagged_injection and r.mode == "fallback", (r.flagged_injection, r.mode)
    return "注入已標記；回答改為固定版本"


@case("T18 【陷阱】知識庫被竄改（要 AI 說補助 10 萬元）→ 標記注入、不能當佐證、改用固定版本")
async def t18():
    db = fresh("test")
    r, a = await run("chen", [[("read_policy", {"uri": "kb://ltc1966"})],
                              "政府一定補助 10 萬元。", "政府一定補助 10 萬元。"], "補助多少？", db=db)
    assert a.evidence[0].flagged_injection, "沒有偵測到知識庫中的注入"
    assert r.mode == "fallback" and "10 萬" not in r.answer, (r.mode, r.answer)
    return r.answer.splitlines()[0]


@case("T25 讀取補助說明（展示資料）→ 照說明回答 1966 → 通過")
async def t25():
    r, _ = await run("chen", [[("read_policy", {"uri": "kb://ltc1966"})],
                              "如果要動到門檻和防水，可以撥長照專線 1966 申請評估；補助多少以照管專員評估與地方政府核定為準，"
                              "核准前不施工。"], "改門檻有補助嗎？")
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T19 【陷阱】單位填錯（走道 0.92 cm、床到浴室 500 m）→ 不判斷，要求重新量測")
async def t19():
    db = fresh("test")
    r, a = await run("chen", [[("assess_risk", {"household_id": "t_unit"})],
                              lambda m: "走道需要重新量測：" + "、".join(last_tool_json(m)["needs_remeasure"]) + "。"],
                     "測試甲家結果？", db=db)
    d = a.evidence[0].data
    z = {x["zone"]: x["light_name"] for x in d["zones"]}
    assert z["走道"] == "尚未判斷" and "床邊到浴室走道寬" in d["needs_remeasure"], d
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T20 【陷阱】AI 把 0.92 cm 說成 0.92 公尺 → 單位不符被攔下")
async def t20():
    db = fresh("test")
    r, _ = await run("chen", [[("get_ar_measures", {"household_id": "t_unit"})],
                              "走道寬 0.92 公尺，夠寬。", "走道寬 0.92 公尺。"], "走道多寬？", db=db)
    assert r.mode == "fallback" and any("0.92 公尺" in i for i in r.checks[0].issues), r.checks
    return r.checks[0].issues[0]


@case("T21 【陷阱】邊界值：門檻 3 cm＝黃燈、3.05 cm（記為 3.1）＝紅燈；沒量門檻＝尚未判斷")
async def t21():
    from servers import rules
    ans = make_data.LIN_ANS
    z = lambda m: {x["zone"]: x["light_name"] for x in rules.assess(ans, rules.validate_measures(m)[0])}  # noqa: E731
    assert z({"threshold_cm": 3})["浴室"] == "黃燈", "3 cm 應為黃燈"
    assert rules.validate_measures({"threshold_cm": 3.05})[0]["threshold_cm"] == 3.1, "3.05 應記為 3.1（與原型相同）"
    assert z({"threshold_cm": 3.05})["浴室"] == "紅燈", "3.05 cm 應為紅燈"
    assert z({"corridor_cm": 100})["浴室"] == "尚未判斷", "沒量門檻應為尚未判斷"
    return "3 cm 黃燈｜3.05 cm 記為 3.1、紅燈｜未量測 尚未判斷"


@case("T22 【陷阱】兩筆量測紀錄互相矛盾 → 用最新一筆並說明忽略了幾筆")
async def t22():
    db = fresh("test")
    r, a = await run("chen", [[("assess_risk", {"household_id": "t_dup"})],
                              lambda m: f"依 {last_tool_json(m)['based_on_measurement']} 的量測，浴室是綠燈。"],
                     "測試戊家浴室？", db=db)
    d = a.evidence[0].data
    assert d["older_records_ignored"] == 1 and {x["zone"]: x["light_name"] for x in d["zones"]}["浴室"] == "綠燈"
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T23 【陷阱】保單失效的工班不能派；選錯技能也不能派")
async def t23():
    db = fresh()
    con = sqlite3.connect(db)
    con.execute("UPDATE cases SET status='待派工', option_ids='[\"H1\",\"B1\",\"D2\"]' WHERE id='C-LIN'")
    con.commit()
    con.close()
    d3 = day(db, 3)
    r, a = await run("wang", [[("assign_work_package", {"case_id": "C-LIN", "day": d3, "tech_id": "wu",
                                                        "crew_ids": ["crewD"]})],
                              [("assign_work_package", {"case_id": "C-LIN", "day": d3, "tech_id": "wu",
                                                        "crew_ids": ["crewB"]})],
                              "兩次派工都被系統拒絕，沒有派工。"], "派工", db=db)
    assert "保單" in a.evidence[0].text and "還缺" in a.evidence[1].text, (a.evidence[0].text, a.evidence[1].text)
    return a.evidence[0].text + "｜" + a.evidence[1].text


@case("T24 【陷阱】型別：長輩同意傳成 True（不是「同意」）→ 拒絕，不會誤判成同意")
async def t24():
    db = fresh()
    con = sqlite3.connect(db)
    con.execute("UPDATE cases SET status='待長輩本人確認', option_ids='[\"H1\"]' WHERE id='C-LIN'")
    con.commit()
    con.close()
    r, a = await run("wang", [[("record_elder_consent", {"case_id": "C-LIN", "decision": "True", "method": "當面"})],
                              "參數不正確，沒有記錄。"], "記錄同意", db=db)
    assert not a.evidence[0].ok, a.evidence[0].text
    with sqlite3.connect(db) as c:
        assert c.execute("SELECT status FROM cases WHERE id='C-LIN'").fetchone()[0] == "待長輩本人確認"
    return "decision=\"True\" 被拒絕，案件狀態不變"


# ---------------- v1.1 新增 ----------------
@case("T26 【v1.1】夜間關懷兩次詢問：燈光語音回覆＝平安；家中電話回覆＝平安；兩次都沒回應才通知家人")
async def t26():
    from servers import rules
    base = {"enter_bath": "02:10", "leave_bath": None, "asked_at": "02:40"}
    a = rules.evaluate_night(base | {"elder_reply": "燈光語音"}, "林媽媽")
    b = rules.evaluate_night(base | {"elder_reply": "家中電話"}, "林媽媽")
    c = rules.evaluate_night(base | {"elder_reply": None}, "林媽媽")
    d = rules.evaluate_night(base | {"leave_bath": "02:20", "elder_reply": None}, "林媽媽")
    assert a["status"] == "長輩已回覆平安" and a["asks"] == 1, a
    assert b["status"] == "長輩已回覆平安" and b["asks"] == 2, b
    assert any("撥打家中電話" in x[1] for x in b["timeline"]), b["timeline"]
    assert c["status"] == "需通知家人" and c["asks"] == 2, c
    assert ["02:45", "林媽媽 5 分鐘未回應，第 2 次詢問：撥打家中電話"] in c["timeline"], c["timeline"]
    assert any("兩次詢問都沒有回應" in x[1] for x in c["timeline"]), c["timeline"]
    assert d["status"] == "正常起夜", d
    return "燈光語音回覆｜家中電話回覆｜兩次都沒回應 → 只有最後一種通知家人"


@case("T27 【v1.1】第 2 次詢問才接電話 → 判斷為平安，不能通知家人")
async def t27():
    db = fresh("test")
    r, a = await run("wang", [[("get_night_events", {"household_id": "t_edge", "night": day(db, -1)})],
                              [("notify_family", {"household_id": "t_edge", "event_id": "N-T-PHONE",
                                                  "message": "測試乙夜間未回應"})],
                              "測試乙第 2 次詢問時接起家中電話，回覆平安，不需要通知家人。"], "昨晚測試乙家？", db=db)
    ev0 = a.evidence[0].data["events"][0]
    assert ev0["status"] == "長輩已回覆平安" and ev0["asks"] == 2, ev0
    assert not a.evidence[1].ok and "長輩已回覆平安" in a.evidence[1].text, a.evidence[1].text
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T28 【v1.1】同一區可複選：影片中的走道「感應夜燈＋止滑卡扣地板」加浴室斜坡墊 → 10,000 元，推薦示範地坪 C＋吳技師")
async def t28():
    db = fresh()
    opts = ["H1", "H2", "B1"]

    def ans(m):
        d = last_tool_json(m)
        return f"一次付清 {d['one_time_total_twd']:,} 元，月費 {d['monthly_fee_twd']} 元。"
    r, _ = await run("chen", [[("estimate_quote", {"household_id": "lin", "option_ids": opts})], ans],
                     "走道感應夜燈加止滑卡扣地板、浴室斜坡墊，多少錢？", db=db)
    assert r.mode == "verified" and "10,000 元" in r.answer, (r.mode, r.answer)
    r2, a2 = await run("chen", [[("estimate_quote", {"household_id": "lin", "option_ids": ["H1", "H1"]})],
                                "做法重複了，請每個做法只列一次。"], "重複試算", db=db)
    assert not a2.evidence[0].ok and "重複" in a2.evidence[0].text, a2.evidence[0].text
    con = sqlite3.connect(db)
    con.execute("UPDATE cases SET status='待派工', option_ids='[\"H1\",\"H2\",\"B1\"]' WHERE id='C-LIN'")
    con.commit()
    con.close()

    def ans2(m):
        d = last_tool_json(m)["recommendation"]
        c = d["crews"][0]
        return f"推薦{c['staff']} {c['time']} 先施工，{d['tech']['staff']} {d['tech']['time']} 再安裝。"
    r3, a3 = await run("wang", [[("find_available_staff", {"case_id": "C-LIN", "day": day(db, 3)})], ans2],
                       "誰可以去林媽媽家？", db=db)
    rec = a3.evidence[0].data["recommendation"]
    assert [c["staff"] for c in rec["crews"]] == ["示範地坪 C"] and rec["tech"]["staff"] == "吳技師", rec
    assert r3.mode == "verified", (r3.mode, r3.checks)
    return f"{r.answer}｜{r3.answer}"


@case("T29 【v1.1】補助轉介寫明長照需要等級第 2 級以上 → 照說明回答通過；說成「一定補助」被攔下")
async def t29():
    r, a = await run("chen", [[("read_policy", {"uri": "kb://ltc1966"})],
                              "如果林媽媽的長照需要等級達第 2 級以上，生活顧問會協助撥打 1966，申請居家無障礙改善補助；"
                              "還沒有等級的話，可以先撥 1966 申請評估。"], "改門檻有補助嗎？")
    assert "第 2 級以上" in a.evidence[0].text, a.evidence[0].text
    assert r.mode == "verified", (r.mode, r.checks)
    r2, _ = await run("chen", [[("read_policy", {"uri": "kb://ltc1966"})],
                               "只要是長輩，政府一定補助 4 萬元。", "政府一定補助 4 萬元。"], "補助多少？",
                      verifier=FakeVerifier(("一定補助",)))
    assert r2.mode == "fallback" and "4 萬" not in r2.answer, (r2.mode, r2.answer)
    return r.answer


# ---------------- v1.2 新增：全國電子實際商品 ----------------
@case("T30 【v1.2】查全國電子現售夜間照明：照官網貨號與售價回答 → 通過，並說明光控不是人體感應")
async def t30():
    def ans(m):
        d = last_tool_json(m)
        p = {x["sku"]: x for x in d["products"]}
        return (f"全國電子官網有{p['2092127']['name']}（{p['2092127']['price_twd']} 元）和"
                f"{p['2092126']['name']}（{p['2092126']['price_twd']} 元），兩款都是光控、不是人體感應；"
                f"米家感應夜燈標價 {p['2096290']['price_twd']} 元，但商品頁打不開，要先確認是否還在賣。售價以門市為準。")
    r, a = await run("chen", [[("find_store_products", {"category": "夜間照明"})], ans], "全國電子有賣哪些夜燈？")
    d = a.evidence[0].data
    assert "不是模擬資料" in d["data_label"] and {x["item"] for x in d["not_found_on_site"]} == {"人體感應夜燈", "門檻提示燈條"}, d
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T31 【v1.2】AI 說「全國電子有賣門窗感測器 299 元」→ 官網查不到、價格沒有根據 → 攔下")
async def t31():
    r, a = await run("chen", [[("find_store_products", {"category": "感測與連網"})],
                              "全國電子有賣門窗感測器，一個 299 元。", "全國電子有賣門窗感測器。"], "有門窗感測器嗎？",
                     verifier=FakeVerifier(("有賣門窗感測器",)))
    assert "門窗感測器" in [g["item"] for g in a.evidence[0].data["not_found_on_site"]]
    assert r.mode == "fallback" and "官網查不到" in r.answer and "門窗感測器" in r.answer, (r.mode, r.answer)
    return r.answer.splitlines()[0][:120]


@case("T32 【v1.2→v1.3】商品類別亂填 → 工具拒絕；預設查全部會列出 8 個缺口（v1.3 加入施工服務的缺口）")
async def t32():
    r, a = await run("chen", [[("find_store_products", {"category": "家電"})], [("find_store_products", {})],
                              "類別填錯了，改查全部。"], "查商品")
    assert not a.evidence[0].ok, a.evidence[0].text
    gaps = [g["item"] for g in a.evidence[1].data["not_found_on_site"]]
    assert a.evidence[1].ok and len(gaps) == 8 and "泥作、木作、門窗、地坪止滑工程" in gaps, gaps
    return f"錯誤類別被拒絕；全部類別缺口 {len(gaps)} 項"


# ---------------- v1.3 新增：量測來源與信心度、現場差異、晨起與感測器、家電檔案、場域開關、補助 ----------------
@case("T33 【v1.3】林媽媽家燈號不變；每個量測都有來源與信心度，材質三項都可帶入")
async def t33():
    r, a = await run("chen", [[("get_ar_measures", {"household_id": "lin"})], [("assess_risk", {"household_id": "lin"})],
                              "走道是紅燈、浴室是黃燈，量測來自 AR 掃描。"], "我媽家量得準嗎？")
    m, z = a.evidence[0].data, {x["zone"]: x["light_name"] for x in a.evidence[1].data["zones"]}
    assert z["走道"] == "紅燈" and z["浴室"] == "黃燈" and not a.evidence[1].data["needs_site_check"], z
    assert {x["source"] for x in m["measures"]} == {"AR 掃描", "家人手動輸入"}, m["measures"]
    assert all(x["check"] == "可帶入" for x in m["materials"]), m["materials"]
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T34 【v1.3】黃先生家門檻 3 cm 剛好在分界 → 燈號照規則（黃燈），但標成需技師到府確認")
async def t34():
    r, a = await run("wang", [[("assess_risk", {"household_id": "huang"})], "黃先生家浴室是綠燈。", "浴室綠燈。"],
                     "黃先生家浴室？")
    d = a.evidence[0].data
    bath = next(x for x in d["zones"] if x["zone"] == "浴室")
    assert bath["light_name"] == "黃燈" and bath["needs_site_check"] and d["needs_site_check"] == ["浴室"], bath
    assert r.mode == "fallback" and "需技師到府確認" in r.answer, r.answer
    return bath["site_check_note"]


@case("T35 【v1.3】AR 信心度 55% → 浴室不判斷；AI 硬說「浴室紅燈」→ 攔下")
async def t35():
    r, a = await run("chen", [[("assess_risk", {"household_id": "t_conf"})], "浴室是紅燈，門檻 3.2 cm。",
                              "浴室是紅燈。"], "門檻怎樣？", db=fresh("test"))
    d = a.evidence[0].data
    bath = next(x for x in d["zones"] if x["zone"] == "浴室")
    assert bath["light_name"] == "尚未判斷" and "浴室門檻高度" in d["needs_remeasure"], d
    assert r.mode == "fallback" and "尚未判斷" in r.answer, r.answer
    return r.answer.splitlines()[0]


@case("T36 【v1.3】材質兩個辨識結果不一致、家人沒確認 → 安裝方式一律背膠不鑽孔")
async def t36():
    r, a = await run("chen", [[("recommend_options", {"household_id": "t_mat", "zone": "浴室"})], "浴室可以這樣改。"],
                     "浴室怎麼裝？", db=fresh("test"))
    mat = a.evidence[0].data["install_method_by_material"][0]
    assert "不一致" in mat["check"] and mat["install_note"] == "材質還沒確認前，一律用背膠、不鑽孔", mat
    return mat["check"]


@case("T37 【v1.3】家人用捲尺補量門檻：按 N 不存；按 Y 存成新紀錄並重算燈號")
async def t37():
    db = fresh()
    step = [("record_measurement", {"household_id": "lin", "field": "threshold_cm", "value": 3.6,
                                    "source": "家人手動輸入"})]
    r0, a0 = await run("chen", [step, "已更新門檻量測。", "已更新門檻量測。"], "門檻其實 3.6", db=db, confirm=no)
    assert r0.mode == "fallback" and not a0.evidence[0].ok, r0.answer
    r, a = await run("chen", [step, [("assess_risk", {"household_id": "lin"})],
                              lambda m: "已存成新的量測紀錄：浴室門檻高度 3.6 cm（家人手動輸入），浴室現在是紅燈。"],
                     "門檻其實 3.6", db=db)
    z = {x["zone"]: x["light_name"] for x in a.evidence[1].data["zones"]}
    assert z["浴室"] == "紅燈" and a.evidence[1].data["older_records_ignored"] == 1, z
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T38 【v1.3】方案送出後家人不能自己改量測；技師實測過的值家人不能覆蓋")
async def t38():
    r, a = await run("huang", [[("record_measurement", {"household_id": "huang", "field": "threshold_cm", "value": 2,
                                                         "source": "家人手動輸入"})], "方案已送出，量測要請顧問處理。"],
                     "門檻改 2", db=fresh())
    assert not a.evidence[0].ok and "方案已經送出" in a.evidence[0].text, a.evidence[0].text
    db = fresh()
    con = sqlite3.connect(db)
    con.execute("UPDATE cases SET status='尚未送出' WHERE id='C-LI'")
    con.commit()
    con.close()
    r2, a2 = await run("li_f", [[("record_measurement", {"household_id": "li", "field": "corridor_cm", "value": 70,
                                                          "source": "家人手動輸入"})], "技師量過的值不能改。"],
                       "走道改 70", db=db)
    assert not a2.evidence[0].ok and "技師到府實測" in a2.evidence[0].text, a2.evidence[0].text
    return a2.evidence[0].text


@case("T39 【v1.3】技師到府回報差異 → 顧問核准 → 浴室黃燈變紅燈，要重新確認報價；沒工單的技師看不到")
async def t39():
    db = fresh()
    r, a = await run("chent", [[("report_site_difference", {"household_id": "huang", "field": "threshold_cm",
                                                             "value": 3.4, "note": "門檻實測較高"})],
                               lambda m: f"已回報差異 {last_tool_json(m)['diff_id']}，等生活顧問核准。"],
                     "黃先生家門檻實測 3.4", db=db)
    assert r.mode == "verified" and a.evidence[0].data["status"] == "待顧問核准", (r.mode, r.checks)
    did = a.evidence[0].data["diff_id"]

    def ans(m):
        d = last_tool_json(m)
        ch = d["light_changes"][0]
        return f"已核准差異 {did}，{ch['zone']}由{ch['before']}變成{ch['after']}，要重新確認方案與報價。"
    r2, a2 = await run("wang", [[("approve_site_difference", {"diff_id": did, "decision": "核准"})], ans],
                       "核准差異", db=db)
    ch = a2.evidence[0].data["light_changes"]
    assert {"zone": "浴室", "before": "黃燈", "after": "紅燈"} in ch, ch
    assert r2.mode == "verified", (r2.mode, r2.checks)
    r3, a3 = await run("wu", [[("report_site_difference", {"household_id": "huang", "field": "threshold_cm",
                                                            "value": 3.4})], "沒有權限。"], "回報", db=db)
    assert not a3.evidence[0].ok and "權限不足" in a3.evidence[0].text, a3.evidence[0].text
    return r2.answer


@case("T40 【v1.3】晨起確認：兩次都沒回應才可通知家人；正常作息不能通知")
async def t40():
    db = fresh("test")
    r, a = await run("wang", [[("get_care_events", {"household_id": "t_edge", "day": day(db, -1)})],
                              [("notify_family", {"household_id": "t_edge", "event_id": "M-T-NONE",
                                                  "message": "長輩早上沒有活動，兩次詢問都沒回應"})],
                              "已通知家人。"], "晨起確認", db=db)
    assert a.evidence[0].data["events"][0]["status"] == "需通知家人" and a.evidence[1].ok, a.evidence[1].text
    assert r.mode == "verified", (r.mode, r.checks)
    r2, a2 = await run("wang", [[("notify_family", {"household_id": "lin", "event_id": "M-LIN-1", "message": "測試"})],
                                "已通知家人。", "已通知家人。"], "通知", db=fresh())
    assert not a2.evidence[0].ok and "正常作息" in a2.evidence[0].text and r2.mode == "fallback", a2.evidence[0].text
    db3 = fresh("test")
    con = sqlite3.connect(db3)
    con.execute("DELETE FROM contacts WHERE household_id='t_edge'")
    con.commit()
    con.close()
    r3, a3 = await run("wang", [[("notify_family", {"household_id": "t_edge", "event_id": "M-T-NONE", "message": "測試"})],
                                "已通知家人。", "已通知家人。"], "通知", db=db3)
    assert not a3.evidence[0].ok and "還沒有設定聯絡人" in a3.evidence[0].text and r3.mode == "fallback", a3.evidence[0].text
    return a2.evidence[0].text + "｜" + a3.evidence[0].text


@case("T41 【v1.3】感測器離線 45 分鐘 → 判斷為設備問題（不是長輩出事），通知時說明是設備問題")
async def t41():
    db = fresh()
    r, a = await run("wang", [[("get_care_events", {"household_id": "li", "day": day(db, -1)})],
                              [("notify_family", {"household_id": "li", "event_id": "S-LI-1",
                                                  "message": "浴室門感測器離線，是設備問題，門市會安排檢修"})],
                              "浴室門感測器離線，判斷是設備問題，已通知李小姐，門市會安排檢修。"], "感測器", db=db)
    e = a.evidence[0].data["events"][0]
    assert e["status"] == "設備離線" and a.evidence[1].data["kind"] == "設備問題", (e, a.evidence[1].text)
    assert r.mode == "verified", (r.mode, r.checks)
    return r.answer


@case("T42 【v1.3】家電檔案：保固到期日與下次保養日由程式算；AI 把清洗費講錯 → 攔下")
async def t42():
    db = fresh()

    def ans(m):
        d = last_tool_json(m)
        x = next(i for i in d["due"] if "冷氣" in i["name"])
        return f"李先生家冷氣 {x['next_maintenance']} 要清洗，全國空調清洗 {x['service_price_twd']:,} 元。"
    r, a = await run("wang", [[("get_maintenance_due", {"within_days": 30})], ans], "最近誰要保養？", db=db)
    assert r.mode == "verified" and "2,399 元" in r.answer, (r.mode, r.checks)
    r2, _ = await run("wang", [[("get_maintenance_due", {"within_days": 30})], "冷氣清洗 1,999 元。",
                               "冷氣清洗 1,999 元。"], "保養", db=db)
    assert r2.mode == "fallback" and "1,999" not in r2.answer, r2.answer
    r3, a3 = await run("li_f", [[("get_appliance_profile", {"household_id": "li"})], "x", "x"], "家電檔案", db=db)
    kit = next(i for i in a3.evidence[0].data["appliances"] if i["appliance_id"] == "A-LI-1")
    mat = next(i for i in a3.evidence[0].data["appliances"] if i["appliance_id"] == "A-LI-3")
    assert kit["warranty_status"] == "保固中" and mat["warranty_status"] == "保固資料待補", (kit, mat)
    return r.answer


@case("T43 【v1.3】一鍵預約保養：要確認、不重複建立；沒預約就說「已預約」→ 攔下")
async def t43():
    db = fresh()
    step = [("book_maintenance", {"household_id": "li", "appliance_id": "A-LI-4", "day": day(db, 10)})]
    r, a = await run("li_f", [step, lambda m: f"已預約保養：{last_tool_json(m)['appliance']}，{day(db, 10)}。"],
                     "幫我約冷氣清洗", db=db)
    assert r.mode == "verified" and a.evidence[0].data["status"] == "待顧問排程", (r.mode, r.checks)
    r2, a2 = await run("li_f", [step, "這項已經預約過了。"], "再約一次", db=db)
    assert "沒有重複建立" in a2.evidence[0].data["note"], a2.evidence[0].text
    r3, _ = await run("li_f", [[("get_appliance_profile", {"household_id": "li"})], "已幫您預約好冷氣清洗。",
                               "已預約好冷氣清洗。"], "冷氣", db=fresh())
    assert r3.mode == "fallback", (r3.mode, r3.answer)
    return r.answer


@case("T44 【v1.3】場域開關：揪食光尚未開放 → 不給價格；AI 自己說「加購 150 元」→ 攔下")
async def t44():
    r, a = await run("chen", [[("get_scene_plan", {"scene": "揪食光"})], "揪食光加購每月 150 元。", "揪食光加購 150 元。"],
                     "揪食光多少？")
    assert a.evidence[0].data["available"] is False and r.mode == "fallback" and "尚未開放" in r.answer, r.answer
    r2, a2 = await run("chen", [[("get_scene_plan", {"scene": "揪夜安"})],
                                lambda m: f"揪夜安月費 {last_tool_json(m)['monthly_fee_twd']} 元，早上 10:00 還沒活動會先問長輩。"],
                       "揪夜安包含什麼？")
    assert r2.mode == "verified", (r2.mode, r2.checks)
    return r.answer.splitlines()[0]


@case("T45 【v1.3】補助對照：斜坡墊對應 FA03 斜坡板上限 3,500 元、三年 40,000 元 → 有根據；說「免費」→ 攔下")
async def t45():
    def ans(m):
        o = next(x for x in last_tool_json(m, 0)["options"] if x["id"] == "B1")["ltc_subsidy_items"][0]
        return (f"斜坡墊＋止滑地墊對應長照給付 {o['code']} {o['item']}，上限 {o['cap_twd']:,} 元；居家無障礙改善每 3 年最高 "
                "40,000 元，一般戶自付 30%，要長照需要等級第 2 級以上，由照管專員評估。")
    r, a = await run("chen", [[("recommend_options", {"household_id": "lin", "zone": "浴室"})],
                              [("read_policy", {"uri": "kb://ltc1966"})], ans], "有補助嗎？")
    assert r.mode == "verified", (r.mode, r.checks)
    r2, _ = await run("chen", [[("recommend_options", {"household_id": "lin", "zone": "浴室"})],
                               "斜坡墊有補助，完全免費。", "完全免費。"], "有補助嗎？",
                      verifier=FakeVerifier(("免費",)))
    assert r2.mode == "fallback", r2.mode
    return r.answer


@case("T46 【v1.3】查全國電子保養服務：空調清洗 2,399 元（官網）")
async def t46():
    r, a = await run("chen", [[("find_store_products", {"category": "保養與保固"})],
                              lambda m: "全國空調清洗室內機加室外機 2,399 元，售價以門市為準。"], "冷氣清洗多少？")
    names = [p["name"] for p in a.evidence[0].data["products"]]
    assert "全國空調清洗-室內機+室外機" in names and r.mode == "verified", (names, r.checks)
    return r.answer


# ---------------- 阿國核心（#14）：工具參數型別要嚴格 ----------------
@case("T47 【#14】工具參數傳成字串 \"76\"、\"3.6\" → 守門擋下（型別錯誤），不會被自動轉成數字")
async def t47():
    r, a = await run("wang", [[("get_maintenance_due", {"within_days": "76"})], "參數型別錯誤，沒有查詢。"], "保養名單")
    assert not a.evidence[0].ok and "參數型別錯誤" in a.evidence[0].text, a.evidence[0].text
    r2, a2 = await run("chen", [[("record_measurement", {"household_id": "lin", "field": "threshold_cm", "value": "3.6",
                                                         "source": "家人手動輸入"})], "沒有存。"], "門檻 3.6")
    assert not a2.evidence[0].ok and "參數型別錯誤" in a2.evidence[0].text, a2.evidence[0].text
    return a.evidence[0].text


@case("T48 【#14】數字欄位傳成布林 False → 拒絕")
async def t48():
    r, a = await run("chen", [[("record_measurement", {"household_id": "lin", "field": "outlets", "value": False,
                                                       "source": "家人手動輸入"})], "沒有存。"], "插座")
    assert not a.evidence[0].ok and "參數型別錯誤" in a.evidence[0].text, a.evidence[0].text
    return a.evidence[0].text


@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    shutil.rmtree(TMP, ignore_errors=True)


@pytest.mark.parametrize("fn", CASES, ids=[c.case_name.split(" ", 1)[0] for c in CASES])
def test_flow(fn):
    asyncio.run(fn())
    name, ok, note = RESULTS[-1]
    assert ok, f"{name}：{note}"


async def main():
    for fn in CASES:
        await fn()
    width = max(len(n) for n, _, _ in RESULTS)
    for n, ok, note in RESULTS:
        print(f"{'PASS' if ok else 'FAIL'}  {n.ljust(width)}  {note[:160].replace(chr(10), ' ')}")
    passed = sum(ok for _, ok, _ in RESULTS)
    print(f"\n模擬LLM 流程測試：{passed}/{len(RESULTS)} 通過")
    shutil.rmtree(TMP, ignore_errors=True)
    sys.exit(0 if passed == len(RESULTS) else 1)


if __name__ == "__main__":
    asyncio.run(main())
