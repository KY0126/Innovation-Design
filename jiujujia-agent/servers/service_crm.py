"""MCP Server 3｜service-crm：案件、長輩同意、派工與夜間關懷（對應全國電子 CRM／派工系統）。"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcp.server import MCPServer  # noqa: E402
from mcp.server.mcpserver.exceptions import ToolError  # noqa: E402

from servers import rules  # noqa: E402
from servers.common import DAY_RE, Ctx, audit, db, now, ok  # noqa: E402

NAME = "service-crm"
mcp = MCPServer(NAME, instructions="揪居家案件與關懷：送出方案、長輩本人同意、AI 推薦派工、夜間關懷。會改變狀態的工具都需要使用者確認。")
CTX = Ctx()


def _options(c, ids: list[str]) -> list[dict]:
    if not ids:
        return []
    rows = {r["id"]: r for r in c.execute(f"SELECT * FROM options WHERE id IN ({','.join('?' * len(ids))})", ids)}
    return [{"id": r["id"], "zone": r["zone"], "name": r["name"], "price": r["price"], "by_team": r["by_team"],
             "skill": r["skill"]} for r in (rows[i] for i in ids)]


def _case_of(c, household_id: str):
    return c.execute("SELECT * FROM cases WHERE household_id=?", (household_id,)).fetchone()


def _orders(c, case_id: str) -> list[dict]:
    return [{"work_order": r["id"], "staff": r["name"], "kind": r["kind"], "day": r["day"], "time": r["time"],
             "package": r["package"], "status": r["status"]}
            for r in c.execute("SELECT w.*, s.name, s.kind FROM work_orders w JOIN staff s ON s.id=w.staff_id "
                               "WHERE case_id=? ORDER BY day, time", (case_id,))]


def _valid_day(c, day: str) -> None:
    if not isinstance(day, str) or not DAY_RE.match(day):
        raise ToolError("day 格式要寫成 YYYY-MM-DD，例如 2026-11-05。")
    first, last = c.execute("SELECT MIN(day), MAX(day) FROM slots").fetchone()
    if not (first <= day <= last):
        raise ToolError(f"目前只能查 {first} 到 {last} 的排班。")


@mcp.tool()
def get_case_status(household_id: str) -> str:
    """查案件目前進度：狀態、已選做法、長輩同意紀錄、已排定的工單。使用者問「現在怎樣」時用這個。唯讀。"""
    with db() as c:
        h = CTX.household(c, household_id)
        k = _case_of(c, household_id)
        if not k:
            raise ToolError("這個家庭還沒有建立案件。")
        opts = _options(c, json.loads(k["option_ids"]))
        orders = _orders(c, k["id"])
    audit(NAME, "get_case_status", CTX, {"household_id": household_id}, "ok")
    return ok({"case_id": k["id"], "household": h["name"], "status": k["status"],
               "selected_options": [{"option_id": o["id"], "zone": o["zone"], "name": o["name"]} for o in opts],
               "submitted_at": k["submitted_at"],
               "elder_consent": {"decision": k["consent"], "method": k["consent_method"], "at": k["consent_at"]}
               if k["consent"] else "尚未取得長輩本人同意",
               "work_orders": orders})


@mcp.tool()
def submit_to_advisor(household_id: str, option_ids: list[str]) -> str:
    """【會改變狀態】家人確認方案後，一鍵送給生活顧問整合報價。同一區可以選多種做法。只有家人可以執行。
    重複送出相同內容不會建立第二筆。"""
    CTX.require_role("family")
    if not isinstance(option_ids, list) or not option_ids or not all(isinstance(x, str) for x in option_ids):
        raise ToolError("option_ids 必須是非空的文字清單，例如 [\"H1\",\"B1\",\"D2\"]。")
    with db() as c:
        h = CTX.household(c, household_id)
        k = _case_of(c, household_id)
        known = {r[0]: r[1] for r in c.execute("SELECT id, zone FROM options")}
        bad = [x for x in option_ids if x not in known]
        if bad:
            raise ToolError(f"找不到這些做法：{'、'.join(bad)}。")
        if len(set(option_ids)) != len(option_ids):
            raise ToolError("option_ids 有重複的做法，每個做法只列一次（同一區可以選多種做法）。")
        if k and k["status"] != "尚未送出":
            if json.loads(k["option_ids"]) == option_ids:
                audit(NAME, "submit_to_advisor", CTX, {"household_id": household_id}, "idempotent")
                return ok({"case_id": k["id"], "status": k["status"], "note": "這個方案先前已送出，沒有重複建立"})
            raise ToolError(f"案件目前是「{k['status']}」，不能再改送方案，請聯絡生活顧問。")
        a = c.execute("SELECT measures FROM assessments WHERE household_id=? ORDER BY measured_on DESC, id DESC",
                      (household_id,)).fetchone()
        valid, _ = rules.validate_measures(json.loads(a["measures"]))
        opts = _options(c, option_ids)
        q = rules.quote(opts, rules.care_kit_items(valid))
        advisor = c.execute("SELECT name FROM users WHERE role='advisor' AND store_id=?", (h["store_id"],)).fetchone()
        c.execute("UPDATE cases SET status='待長輩本人確認', option_ids=?, quote=?, submitted_by=?, submitted_at=? "
                  "WHERE id=?", (json.dumps(option_ids), json.dumps(q, ensure_ascii=False), CTX.user_id, now(), k["id"]))
    audit(NAME, "submit_to_advisor", CTX, {"household_id": household_id, "option_ids": option_ids}, "submitted")
    return ok({"case_id": k["id"], "status": "待長輩本人確認", "sent_to": advisor["name"] if advisor else None,
               "one_time_total_twd": q["one_time_total_twd"], "monthly_fee_twd": q["monthly_fee_twd"],
               "pending_estimate": [p["name"] for p in q["pending_estimate"]],
               "next_step": "生活顧問整合報價後，請長輩本人確認才算成交"})


@mcp.tool()
def record_elder_consent(case_id: str, decision: Literal["同意", "不同意"],
                         method: Literal["當面", "電話", "App 大字確認"]) -> str:
    """【會改變狀態】記錄長輩本人對報價的決定。只有生活顧問可以執行；家人不能代替長輩同意。"""
    CTX.require_role("advisor")
    with db() as c:
        k = CTX.case(c, case_id)
        if k["status"] != "待長輩本人確認":
            raise ToolError(f"案件目前是「{k['status']}」，不是待長輩本人確認，不能記錄同意。")
        status = "待派工" if decision == "同意" else "長輩未同意"
        c.execute("UPDATE cases SET status=?, consent=?, consent_method=?, consent_at=? WHERE id=?",
                  (status, decision, method, now(), case_id))
    audit(NAME, "record_elder_consent", CTX, {"case_id": case_id, "decision": decision, "method": method}, status)
    return ok({"case_id": case_id, "decision": decision, "method": method, "status": status})


def _recommend(c, k, day: str) -> dict:
    h = c.execute("SELECT * FROM households WHERE id=?", (k["household_id"],)).fetchone()
    pk = rules.work_packages(_options(c, json.loads(k["option_ids"])), with_kit=True)
    free = lambda sid, t: c.execute("SELECT 1 FROM slots WHERE staff_id=? AND day=? AND time=? AND booked=0",  # noqa: E731
                                    (sid, day, t)).fetchone() is not None
    load = lambda sid: c.execute("SELECT COUNT(*) FROM work_orders WHERE staff_id=? AND status!='已完成'",  # noqa: E731
                                 (sid,)).fetchone()[0]
    staff = [dict(r) | {"skills": json.loads(r["skills"])} for r in
             c.execute("SELECT * FROM staff WHERE store_id=?", (h["store_id"],))]
    crews, excluded, missing = [], [], []
    for job in pk["crew_jobs"]:
        cands = [s for s in staff if s["kind"] == "協力工班" and job["skill"] in s["skills"]]
        for s in cands:
            if s["insurance"] != "有效":
                excluded.append({"staff": s["name"], "reason": f"保單狀態「{s['insurance']}」，暫停派工"})
        ok_c = [s for s in cands if s["insurance"] == "有效" and free(s["id"], "09:00")]
        if ok_c:
            pick = sorted(ok_c, key=lambda s: (load(s["id"]), s["id"]))[0]
            crews.append({"staff_id": pick["id"], "staff": pick["name"], "skill": job["skill"], "day": day,
                          "time": "09:00", "items": job["items"], "open_orders": load(pick["id"])})
        else:
            missing.append(f"{job['skill']}協力工班")
    tech_time = ["14:00"] if pk["crew_jobs"] else ["09:00", "14:00"]
    techs = []
    for s in staff:
        if s["kind"] != "技師":
            continue
        t = next((t for t in tech_time if free(s["id"], t)), None)
        if t:
            techs.append({"staff_id": s["id"], "staff": s["name"], "day": day, "time": t,
                          "open_orders": load(s["id"])})
    techs.sort(key=lambda x: (x["open_orders"], x["staff_id"]))
    if not techs:
        missing.append("全國電子技師")
    return {"crews": crews, "techs": techs, "excluded": excluded, "missing": missing, "packages": pk}


@mcp.tool()
def find_available_staff(case_id: str, day: str) -> str:
    """AI 推薦派工人力：依同門市、這天的時段、技能、手上工單數，推薦協力工班（09:00 先施工）與全國電子技師
    （有工班時 14:00 後安裝）。保單失效的工班會被排除並說明。只有生活顧問可以查。唯讀。"""
    CTX.require_role("advisor")
    with db() as c:
        k = CTX.case(c, case_id)
        if k["status"] in ("尚未送出", "長輩未同意"):
            raise ToolError(f"案件目前是「{k['status']}」，還不能安排人力。")
        _valid_day(c, day)
        r = _recommend(c, k, day)
        if r["missing"]:
            later = [row[0] for row in c.execute("SELECT DISTINCT day FROM slots WHERE day>? ORDER BY day", (day,))]
            alt = next((d for d in later if not _recommend(c, k, d)["missing"]), None)
        else:
            alt = None
    audit(NAME, "find_available_staff", CTX, {"case_id": case_id, "day": day}, "ok")
    rec = None
    if not r["missing"]:
        rec = {"crews": r["crews"], "tech": r["techs"][0],
               "why": "同門市、這個時段有空、手上工單最少" + ("；協力工班先施工，技師後安裝" if r["crews"] else "")}
    return ok({"case_id": case_id, "day": day, "case_status": k["status"],
               "can_assign_now": k["status"] == "待派工",
               "consent_note": None if k["status"] == "待派工" else "長輩本人尚未同意，只能先查人力，不能派工",
               "work_packages": r["packages"], "recommendation": rec,
               "other_techs": r["techs"][1:], "excluded": r["excluded"],
               "unavailable": r["missing"], "next_available_day": alt})


@mcp.tool()
def assign_work_package(case_id: str, day: str, tech_id: str, crew_ids: list[str] | None = None) -> str:
    """【會改變狀態】生活顧問核准後派工：協力工班 09:00 先施工，全國電子技師後安裝。
    長輩本人沒有同意就不能派工；人員技能、保單與時段都會再檢查一次。"""
    CTX.require_role("advisor")
    crew_ids = crew_ids or []
    with db() as c:
        k = CTX.case(c, case_id)
        if k["status"] == "已派工":
            audit(NAME, "assign_work_package", CTX, {"case_id": case_id}, "idempotent")
            return ok({"case_id": case_id, "status": "已派工", "note": "這個案件先前已派工，沒有重複派工",
                       "work_orders": _orders(c, case_id)})
        if k["status"] != "待派工":
            raise ToolError(f"不能派工：案件目前是「{k['status']}」。必須先取得長輩本人同意。")
        _valid_day(c, day)
        r = _recommend(c, k, day)
        need = {j["skill"] for j in r["packages"]["crew_jobs"]}
        staff = {s["id"]: s for s in c.execute("SELECT * FROM staff")}
        for cid in crew_ids:
            if cid not in staff or staff[cid]["kind"] != "協力工班":
                raise ToolError(f"{cid} 不是協力工班。")
            if staff[cid]["insurance"] != "有效":
                raise ToolError(f"{staff[cid]['name']} 保單狀態「{staff[cid]['insurance']}」，不能派工。")
        covered = {sk for cid in crew_ids for sk in json.loads(staff[cid]["skills"])}
        if need - covered:
            raise ToolError(f"還缺這些協力工班：{'、'.join(need - covered)}。")
        if tech_id not in staff or staff[tech_id]["kind"] != "技師":
            raise ToolError(f"{tech_id} 不是全國電子技師。")
        tech_time = "14:00" if crew_ids else None
        slots_needed = [(cid, "09:00") for cid in crew_ids]
        if tech_time is None:
            tech_time = next((t for t in ("09:00", "14:00") if c.execute(
                "SELECT 1 FROM slots WHERE staff_id=? AND day=? AND time=? AND booked=0", (tech_id, day, t)).fetchone()), None)
            if tech_time is None:
                raise ToolError(f"{staff[tech_id]['name']} {day} 沒有空檔。")
        slots_needed.append((tech_id, tech_time))
        for sid, t in slots_needed:
            if not c.execute("SELECT 1 FROM slots WHERE staff_id=? AND day=? AND time=? AND booked=0",
                             (sid, day, t)).fetchone():
                raise ToolError(f"{staff[sid]['name']} {day} {t} 已經有排程，請重新查詢人力。")
        n = c.execute("SELECT COUNT(*) FROM work_orders").fetchone()[0]
        for i, (sid, t) in enumerate(slots_needed):
            pkg = ("協力工班施工：" + "、".join(j["items"][0] for j in r["packages"]["crew_jobs"]
                                          if j["skill"] in json.loads(staff[sid]["skills"]))
                   if staff[sid]["kind"] == "協力工班" else "全國電子安裝：" + "、".join(r["packages"]["tech_items"]))
            c.execute("INSERT INTO work_orders VALUES (?,?,?,?,?,?,?)",
                      (f"W-{201 + n + i}", case_id, sid, day, t, pkg, "已排定"))
            c.execute("UPDATE slots SET booked=1 WHERE staff_id=? AND day=? AND time=?", (sid, day, t))
        c.execute("UPDATE cases SET status='已派工' WHERE id=?", (case_id,))
        orders = _orders(c, case_id)
        elder = c.execute("SELECT elder FROM households WHERE id=?", (k["household_id"],)).fetchone()[0]
    audit(NAME, "assign_work_package", CTX, {"case_id": case_id, "day": day, "tech_id": tech_id,
                                              "crew_ids": crew_ids}, "assigned")
    return ok({"case_id": case_id, "status": "已派工", "work_orders": orders,
               "next_step": f"技師與家人的 App 會收到排程；完工後由{elder}逐區驗收"})


@mcp.tool()
def get_night_events(household_id: str, night: str) -> str:
    """查某一晚的夜間關懷事件（night 寫成 YYYY-MM-DD，指當晚開始的日期），依規則判斷是正常起夜、長輩已回覆平安，
    或需要通知家人（先燈光語音、再撥家中電話，兩次都沒回應才通知）。揪夜安預設不裝鏡頭，這裡只有感測器紀錄。唯讀。"""
    if not isinstance(night, str) or not DAY_RE.match(night):
        raise ToolError("night 格式要寫成 YYYY-MM-DD。")
    with db() as c:
        h = CTX.household(c, household_id)
        rows = c.execute("SELECT * FROM night_events WHERE household_id=? AND night=? ORDER BY enter_bath",
                         (household_id, night)).fetchall()
        sent = {r["event_id"]: r for r in c.execute("SELECT * FROM notifications WHERE household_id=?", (household_id,))}
    events = []
    for r in rows:
        e = rules.evaluate_night(dict(r), h["elder"])
        e.update(event_id=r["id"], source=r["source"], sensors=r["sensor"],
                 family_notified=r["id"] in sent)
        events.append(e)
    audit(NAME, "get_night_events", CTX, {"household_id": household_id, "night": night}, "ok")
    return ok({"household_id": household_id, "night": night, "events": events,
               "no_event": not events, "camera": "預設不裝鏡頭，只有感測器紀錄"})


@mcp.tool()
def notify_family(household_id: str, event_id: str, message: str) -> str:
    """【會改變狀態】依聯絡順序通知家人（LINE＋語音電話）。只有長輩兩次詢問都沒回應、事件判斷為「需通知家人」，
    或感測器離線（告知家人是設備問題）才能送出；夜間事件與白天關懷事件（晨起確認、感測器離線）都適用。
    同一事件不會重複通知。只有生活顧問或總部關懷中心可以執行。message 50 字以內。"""
    CTX.require_role("advisor", "hq")
    if not isinstance(message, str) or not (1 <= len(message) <= 50):
        raise ToolError("message 要 1–50 字。")
    with db() as c:
        h = CTX.household(c, household_id)
        r = c.execute("SELECT * FROM night_events WHERE id=? AND household_id=?", (event_id, household_id)).fetchone()
        if r:
            e = rules.evaluate_night(dict(r), h["elder"])
        else:
            r = c.execute("SELECT * FROM care_events WHERE id=? AND household_id=?", (event_id, household_id)).fetchone()
            if not r:
                raise ToolError(f"找不到事件 {event_id}。")
            e = rules.evaluate_care(dict(r), h["elder"])
        if e["status"] not in ("需通知家人", "設備離線"):
            raise ToolError(f"這個事件判斷為「{e['status']}」，不需要通知家人。")
        if c.execute("SELECT 1 FROM notifications WHERE event_id=?", (event_id,)).fetchone():
            audit(NAME, "notify_family", CTX, {"event_id": event_id}, "idempotent")
            return ok({"event_id": event_id, "note": "這個事件已經通知過家人，沒有重複通知"})
        to = c.execute("SELECT name, channel FROM contacts WHERE household_id=? ORDER BY seq LIMIT 1",
                       (household_id,)).fetchone()
        if not to:
            raise ToolError("這個家庭還沒有設定聯絡人，系統沒有通知任何人。請生活顧問直接打電話聯繫家人，並補登聯絡順序。")
        c.execute("INSERT INTO notifications (household_id, event_id, to_name, message, at) VALUES (?,?,?,?,?)",
                  (household_id, event_id, to["name"], message, now()))
    audit(NAME, "notify_family", CTX, {"household_id": household_id, "event_id": event_id}, "sent")
    if e["status"] == "設備離線":
        return ok({"event_id": event_id, "notified": to["name"], "channel": to["channel"], "message": message,
                   "kind": "設備問題", "store_followup": "門市安排檢修；這不代表長輩發生狀況，不會往下通知其他聯絡人"})
    return ok({"event_id": event_id, "notified": to["name"], "channel": to["channel"], "message": message,
               "next_if_no_reply": f"{rules.CARE_RULES['family_no_response_min']} 分鐘未回應會通知下一位聯絡人"})


@mcp.tool()
def get_care_events(household_id: str, day: str) -> str:
    """查某一天的白天關懷事件（day 寫成 YYYY-MM-DD）：晨起確認（早上 10:00 還沒活動，先語音、再撥家中電話，兩次都沒回應才通知家人）
    與感測器離線（超過 30 分鐘沒回傳，視為設備問題）。揪夜安預設不裝鏡頭，這裡只有感測器紀錄。唯讀。"""
    if not isinstance(day, str) or not DAY_RE.match(day):
        raise ToolError("day 格式要寫成 YYYY-MM-DD。")
    with db() as c:
        h = CTX.household(c, household_id)
        rows = c.execute("SELECT * FROM care_events WHERE household_id=? AND day=? ORDER BY id",
                         (household_id, day)).fetchall()
        sent = {r["event_id"] for r in c.execute("SELECT event_id FROM notifications WHERE household_id=?", (household_id,))}
    events = []
    for r in rows:
        e = rules.evaluate_care(dict(r), h["elder"])
        e.update(event_id=r["id"], source=r["source"], sensors=r["sensor"], family_notified=r["id"] in sent)
        events.append(e)
    audit(NAME, "get_care_events", CTX, {"household_id": household_id, "day": day}, "ok")
    return ok({"household_id": household_id, "day": day, "events": events, "no_event": not events,
               "camera": "預設不裝鏡頭，只有感測器紀錄"})


@mcp.tool()
def get_appliance_profile(household_id: str) -> str:
    """查家電檔案：揪夜安關懷設備、改善項目與登錄的既有家電，各自的安裝日、保固到期日、保養週期與下次保養日，
    以及對應的全國電子保養服務與價格。保固月數沒有資料時寫「保固資料待補」。唯讀。"""
    today = date.today()
    with db() as c:
        CTX.household(c, household_id)
        rows = [dict(r) for r in c.execute("SELECT * FROM appliances WHERE household_id=? ORDER BY installed_on, id",
                                            (household_id,))]
        reqs = [dict(r) for r in c.execute("SELECT * FROM maintenance_requests WHERE household_id=?", (household_id,))]
    items = []
    for a in rows:
        st = rules.appliance_status(a, today)
        items.append({"appliance_id": a["id"], "name": a["name"], "kind": a["kind"], "installed_on": a["installed_on"],
                      "warranty_months": a["warranty_months"], "warranty_note": a["warranty_note"], **st,
                      "maintenance": a["maintenance"], "cycle_months": a["cycle_months"],
                      "service": a["service_name"], "service_price_twd": a["service_price"],
                      "service_price_source": a["service_price_source"],
                      "booked": [r["day"] for r in reqs if r["appliance_id"] == a["id"]]})
    audit(NAME, "get_appliance_profile", CTX, {"household_id": household_id}, "ok")
    return ok({"household_id": household_id, "today": today.isoformat(), "appliances": items, "no_record": not items,
               "note": "家電檔案免費；保養按次計費。驗收後由技師登錄，保固以商品保固書為準"})


@mcp.tool()
def get_maintenance_due(within_days: int = 30) -> str:
    """生活顧問或總部查所屬門市未來 within_days 天內（1–90）要保養或保固快到期的家電，作為提醒名單。
    提醒由系統依名單發送；這個工具只列名單，不會發送。唯讀。"""
    CTX.require_role("advisor", "hq")
    if not isinstance(within_days, int) or not 1 <= within_days <= 90:
        raise ToolError("within_days 要是 1–90 的整數。")
    today = date.today()
    with db() as c:
        q = "SELECT a.*, h.name AS hname, h.store_id FROM appliances a JOIN households h ON h.id=a.household_id"
        rows = [dict(r) for r in c.execute(q) if CTX.role == "hq" or r["store_id"] == CTX.store_id]
        booked = {r["appliance_id"] for r in c.execute("SELECT appliance_id FROM maintenance_requests")}
    due = []
    for a in rows:
        st = rules.appliance_status(a, today)
        reasons = []
        if st["days_until_maintenance"] is not None and st["days_until_maintenance"] <= within_days:
            reasons.append("保養" + ("已逾期" if st["days_until_maintenance"] < 0 else "快到了"))
        if st["warranty_until"] and 0 <= (date.fromisoformat(st["warranty_until"]) - today).days <= within_days:
            reasons.append("保固快到期")
        if reasons:
            due.append({"household": a["hname"], "household_id": a["household_id"], "appliance_id": a["id"],
                        "name": a["name"], "reasons": reasons, **st, "maintenance": a["maintenance"],
                        "service": a["service_name"], "service_price_twd": a["service_price"],
                        "already_booked": a["id"] in booked})
    audit(NAME, "get_maintenance_due", CTX, {"within_days": within_days}, f"{len(due)} items")
    return ok({"today": today.isoformat(), "within_days": within_days, "due": due, "count": len(due)})


@mcp.tool()
def book_maintenance(household_id: str, appliance_id: str, day: str) -> str:
    """【會改變狀態】家人收到保養提醒後一鍵預約：建立保養預約，交給生活顧問排人。只有家人可以執行；
    同一項家電已有預約時不會重複建立。day 寫成 YYYY-MM-DD，要在今天之後 90 天內。"""
    CTX.require_role("family")
    if not isinstance(day, str) or not DAY_RE.match(day):
        raise ToolError("day 格式要寫成 YYYY-MM-DD。")
    d = date.fromisoformat(day)
    if not date.today() < d <= date.today() + timedelta(days=90):
        raise ToolError("預約日要在明天到 90 天內。")
    with db() as c:
        CTX.household(c, household_id)
        a = c.execute("SELECT * FROM appliances WHERE id=? AND household_id=?", (appliance_id, household_id)).fetchone()
        if not a:
            raise ToolError(f"這個家庭的家電檔案裡沒有 {appliance_id}。")
        if not a["cycle_months"]:
            raise ToolError(f"{a['name']}沒有保養項目，不需要預約。")
        dup = c.execute("SELECT * FROM maintenance_requests WHERE appliance_id=? AND status='待顧問排程'",
                        (appliance_id,)).fetchone()
        if dup:
            audit(NAME, "book_maintenance", CTX, {"appliance_id": appliance_id}, "idempotent")
            return ok({"request_id": dup["id"], "day": dup["day"], "status": dup["status"],
                       "note": "這項家電已經預約過，沒有重複建立"})
        rid = f"R-{c.execute('SELECT COUNT(*) FROM maintenance_requests').fetchone()[0] + 1:03d}"
        c.execute("INSERT INTO maintenance_requests VALUES (?,?,?,?,?,?,?)",
                  (rid, household_id, appliance_id, day, CTX.user_id, now(), "待顧問排程"))
    audit(NAME, "book_maintenance", CTX, {"household_id": household_id, "appliance_id": appliance_id, "day": day}, rid)
    return ok({"request_id": rid, "appliance": a["name"], "day": day, "status": "待顧問排程",
               "service": a["service_name"], "service_price_twd": a["service_price"],
               "next_step": "生活顧問會排定技師並通知時段；費用按次計費，到府後確認"})


@mcp.resource("policy://care-rules")
def care_rules() -> str:
    """夜間關懷規則（與原型相同，示範用）。"""
    r = rules.CARE_RULES
    return (f"揪夜安夜間關懷規則（示範用）\n浴室停留超過 {r['bath_stay_min']} 分鐘：第 1 次詢問，燈光閃爍、語音詢問長輩。\n"
            f"長輩 {r['elder_no_response_min']} 分鐘未回應：第 2 次詢問，撥打家中電話。\n"
            "兩次詢問都沒有回應：依序通知家人（LINE＋語音電話）。\n"
            f"家人 {r['family_no_response_min']} 分鐘未回應：通知第二聯絡人，再通知就近聯絡人。由家人判斷是否需要協助。\n"
            f"感測器 {r['sensor_offline_min']} 分鐘沒有回傳：視為設備問題，通知家人與門市，不代表長輩發生狀況。\n"
            f"晨起確認：早上 {rules.MORNING_CHECK} 還沒有任何活動，先語音詢問長輩，{r['elder_no_response_min']} 分鐘沒回應撥家中電話，"
            "兩次都沒回應才通知家人。")


@mcp.resource("kb://ltc1966")
def ltc1966() -> str:
    """長照 1966 補助轉介說明（示範用）：長照需要等級第 2 級以上，顧問協助申請居家無障礙改善補助。"""
    with db() as c:
        r = c.execute("SELECT title, body FROM kb WHERE uri='kb://ltc1966'").fetchone()
    return f"{r['title']}\n{r['body']}"


@mcp.prompt()
def advisor_briefing(household_id: str) -> str:
    """給生活顧問：案件接手摘要範本。"""
    return (f"請依序呼叫 get_home_profile、assess_risk、get_case_status 查 {household_id}，整理給生活顧問的接手摘要："
            "長輩狀況、紅黃綠燈、已選做法、目前卡在哪一步、下一步要做什麼。只寫工具查到的內容。")


if __name__ == "__main__":
    mcp.run(transport="stdio")
