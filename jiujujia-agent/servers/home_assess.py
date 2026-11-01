"""MCP Server 1｜home-assess：長輩家評估（對應揪居家 App 的評估資料）。

v1.3：每個量測值都帶來源與信心度；信心度不足不判斷、離燈號分界太近要技師到府確認；
材質辨識兩道檢查；家人可補量、技師到府「回報差異」、生活顧問核准後才更新。
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Literal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcp.server import MCPServer  # noqa: E402
from mcp.server.mcpserver.exceptions import ToolError  # noqa: E402

from servers import rules  # noqa: E402
from servers.common import Ctx, audit, db, now, ok  # noqa: E402

NAME = "home-assess"
mcp = MCPServer(NAME, instructions="揪居家長輩家評估：問卷、AR 量測、材質辨識與紅黃綠燈判斷。燈號由規則計算，不可自行推測。")
CTX = Ctx()


def _latest(c, household_id: str):
    rows = c.execute("SELECT * FROM assessments WHERE household_id=? ORDER BY measured_on DESC, id DESC",
                     (household_id,)).fetchall()
    if not rows:
        raise ToolError("這個家庭還沒有評估紀錄，請先在 App 完成問卷與 AR 掃描。")
    return rows[0], len(rows) - 1


def _meta(c, assessment_id: int) -> dict:
    return {r["field"]: {"source": r["source"], "confidence_pct": r["confidence_pct"]}
            for r in c.execute("SELECT * FROM measure_meta WHERE assessment_id=?", (assessment_id,))}


def _evaluate(row, meta: dict) -> dict:
    """同一套判斷給三個工具共用（規則在 rules.evaluate，assess 能力也用同一段）。"""
    return rules.evaluate(json.loads(row["answers"]), json.loads(row["measures"]), meta)


@mcp.tool()
def get_home_profile(household_id: str) -> str:
    """查長輩家基本資料：長輩稱呼、狀況、所屬門市、住宅類型、緊急聯絡順序。唯讀。"""
    with db() as c:
        h = CTX.household(c, household_id)
        store = c.execute("SELECT name FROM stores WHERE id=?", (h["store_id"],)).fetchone()["name"]
        contacts = [dict(r) for r in c.execute(
            "SELECT seq, name, relation, channel FROM contacts WHERE household_id=? ORDER BY seq", (household_id,))]
    audit(NAME, "get_home_profile", CTX, {"household_id": household_id}, "ok")
    return ok({"household_id": h["id"], "household": h["name"], "elder": h["elder"], "elder_note": h["elder_note"],
               "store": store, "tenure": h["tenure"], "contacts_in_order": contacts})


@mcp.tool()
def get_ar_measures(household_id: str) -> str:
    """查最新一次量測值、每個值的來源（AR 掃描／參考卡照片／家人手動輸入／技師實測）與信心度，以及材質辨識檢查結果。
    單位：走道寬 cm、門檻高度 cm、床邊到浴室門口 m、插座 個。invalid（超出範圍）與 low_confidence（信心度不足）都不能拿來判斷；
    needs_site_check 代表離燈號分界太近，需技師到府確認。唯讀。"""
    with db() as c:
        CTX.household(c, household_id)
        row, older = _latest(c, household_id)
        meta = _meta(c, row["id"])
        pend = [dict(r) for r in c.execute("SELECT id, field, new_value, status FROM site_diffs "
                                            "WHERE household_id=? AND status='待顧問核准'", (household_id,))]
    raw = json.loads(row["measures"])
    e = _evaluate(row, meta)
    low_fields = {b["field"] for b in e["low"]}
    audit(NAME, "get_ar_measures", CTX, {"household_id": household_id}, "ok")
    return ok({
        "household_id": household_id, "measured_on": row["measured_on"], "older_records_ignored": older,
        "measures": [{"field": k, "label": rules.MEASURES[k][0], "value": v, "unit": rules.MEASURES[k][1],
                      "source": (meta.get(k) or {}).get("source", "AR 掃描"),
                      "confidence_pct": (meta.get(k) or {}).get("confidence_pct")}
                     for k, v in e["valid"].items() if k not in low_fields],
        "invalid": e["invalid"], "low_confidence": e["low"], "needs_site_check": e["near"],
        "not_measured": [rules.MEASURES[k][0] for k in rules.MEASURES if k not in raw],
        "materials": rules.check_materials(json.loads(row["materials"])),
        "pending_site_differences": pend,
        "privacy": "AR 與照片的原始影像分析完即清除，這裡只有量測成果",
    })


@mcp.tool()
def assess_risk(household_id: str) -> str:
    """依問卷與量測，用固定規則算出各區紅黃綠燈與原因（紅燈要優先處理、黃燈建議改善、綠燈沒有明顯風險）。
    needs_site_check 為 true 的區域，量測值離分界太近，需技師到府確認。唯讀。"""
    with db() as c:
        CTX.household(c, household_id)
        row, older = _latest(c, household_id)
        e = _evaluate(row, _meta(c, row["id"]))
    zones = e["zones"]
    audit(NAME, "assess_risk", CTX, {"household_id": household_id}, "ok")
    return ok({
        "household_id": household_id, "based_on_measurement": row["measured_on"], "older_records_ignored": older,
        "zones": zones,
        "summary": {n: [z["zone"] for z in zones if z["light_name"] == n] for n in ("紅燈", "黃燈", "綠燈", "尚未判斷")},
        "needs_remeasure": [b["label"] for b in e["invalid"] + e["low"]],
        "needs_site_check": [z["zone"] for z in zones if z.get("needs_site_check")],
        "rule_source": "policy://risk-rules",
    })


def _new_assessment(c, row, field: str, value: float, source: str, confidence: int | None) -> int:
    measures = json.loads(row["measures"])
    measures[field] = value
    nid = c.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM assessments").fetchone()[0]
    c.execute("INSERT INTO assessments VALUES (?,?,?,?,?,?)",
              (nid, row["household_id"], date.today().isoformat(), row["answers"], json.dumps(measures), row["materials"]))
    for r in c.execute("SELECT field, source, confidence_pct FROM measure_meta WHERE assessment_id=?",
                       (row["id"],)).fetchall():
        if r["field"] != field:
            c.execute("INSERT INTO measure_meta VALUES (?,?,?,?)", (nid, r["field"], r["source"], r["confidence_pct"]))
    c.execute("INSERT INTO measure_meta VALUES (?,?,?,?)", (nid, field, source, confidence))
    return nid


def _check_value(field: str, value) -> float:
    if field not in rules.MEASURES:
        raise ToolError(f"沒有 {field} 這個量測欄位，可用：{'、'.join(rules.MEASURES)}。")
    ok_, bad = rules.validate_measures({field: value})
    if bad:
        raise ToolError(f"{bad[0]['label']} {value} {bad[0]['unit']}：{bad[0]['problem']}。這筆沒有存。")
    return ok_[field]


@mcp.tool()
def record_measurement(household_id: str, field: Literal["corridor_cm", "threshold_cm", "bed_bath_m", "outlets"],
                       value: float, source: Literal["AR 掃描", "參考卡照片", "家人手動輸入"],
                       confidence_pct: int | None = None) -> str:
    """【會改變狀態】家人補量或重量一個值（例如 AR 信心度不足、改用捲尺或參考卡照片）。只有家人可以執行；
    方案送出後就不能自己改，要等技師到府回報差異、由生活顧問核准。技師實測過的值家人不能覆蓋。"""
    CTX.require_role("family")
    if source in ("AR 掃描", "參考卡照片") and (confidence_pct is None or not 0 <= confidence_pct <= 100):
        raise ToolError("AR 掃描或參考卡照片要附 0–100 的信心度（量測頁面會顯示）。")
    if source == "家人手動輸入":
        confidence_pct = None
    v = _check_value(field, value)
    with db() as c:
        CTX.household(c, household_id)
        k = c.execute("SELECT status FROM cases WHERE household_id=?", (household_id,)).fetchone()
        if k and k["status"] != "尚未送出":
            raise ToolError(f"方案已經送出（案件狀態：{k['status']}），量測有變請聯絡生活顧問；到府時由技師回報差異。這筆沒有存。")
        row, _ = _latest(c, household_id)
        if (_meta(c, row["id"]).get(field) or {}).get("source") == "技師實測":
            raise ToolError(f"{rules.MEASURES[field][0]}已由技師到府實測，家人不能覆蓋；有疑問請聯絡生活顧問。")
        nid = _new_assessment(c, row, field, v, source, confidence_pct)
        new = c.execute("SELECT * FROM assessments WHERE id=?", (nid,)).fetchone()
        e = _evaluate(new, _meta(c, nid))
    audit(NAME, "record_measurement", CTX, {"household_id": household_id, "field": field, "value": v,
                                             "source": source}, "recorded")
    return ok({"household_id": household_id, "recorded": {"field": field, "label": rules.MEASURES[field][0],
                                                          "value": v, "unit": rules.MEASURES[field][1],
                                                          "source": source, "confidence_pct": confidence_pct},
               "usable_for_assessment": field not in {b["field"] for b in e["low"]},
               "needs_site_check": e["near"],
               "next_step": "已存成新的量測紀錄；請用 assess_risk 重新查看燈號"})


@mcp.tool()
def report_site_difference(household_id: str, field: Literal["corridor_cm", "threshold_cm", "bed_bath_m", "outlets"],
                           value: float, note: str = "") -> str:
    """【會改變狀態】技師到府實測，和 App 量測不同時「回報差異」。只有手上有這個家庭工單的技師可以執行；
    差異要由生活顧問核准後才會更新燈號與方案。note 30 字以內。"""
    CTX.require_role("tech")
    if not isinstance(note, str) or len(note) > 30:
        raise ToolError("note 要 30 字以內。")
    v = _check_value(field, value)
    with db() as c:
        CTX.household(c, household_id)
        k = c.execute("SELECT id FROM cases WHERE household_id=?", (household_id,)).fetchone()
        row, _ = _latest(c, household_id)
        old = json.loads(row["measures"]).get(field)
        if old is not None and float(old) == float(v):
            return ok({"household_id": household_id, "note": "實測值和目前紀錄相同，不需要回報差異"})
        dup = c.execute("SELECT id FROM site_diffs WHERE household_id=? AND field=? AND status='待顧問核准'",
                        (household_id, field)).fetchone()
        if dup:
            raise ToolError(f"這個欄位已有待核准的差異 {dup['id']}，請等生活顧問處理。")
        did = f"D-{c.execute('SELECT COUNT(*) FROM site_diffs').fetchone()[0] + 1:03d}"
        c.execute("INSERT INTO site_diffs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                  (did, household_id, k["id"] if k else None, field, old, v, CTX.user_id, now(), note, "待顧問核准",
                   None, None))
    audit(NAME, "report_site_difference", CTX, {"household_id": household_id, "field": field, "value": v}, did)
    return ok({"diff_id": did, "household_id": household_id, "field": field, "label": rules.MEASURES[field][0],
               "old_value": old, "new_value": v, "unit": rules.MEASURES[field][1], "status": "待顧問核准",
               "next_step": "生活顧問核准前，照原方案施工會先暫停這一區；燈號與報價不變"})


@mcp.tool()
def approve_site_difference(diff_id: str, decision: Literal["核准", "不核准"]) -> str:
    """【會改變狀態】生活顧問核准或不核准技師回報的差異。核准後以技師實測值重算燈號；燈號改變時要重新確認方案與報價。
    只有所屬門市的生活顧問可以執行。"""
    CTX.require_role("advisor")
    with db() as c:
        d = c.execute("SELECT * FROM site_diffs WHERE id=?", (diff_id,)).fetchone()
        if not d:
            raise ToolError(f"找不到差異 {diff_id}。")
        CTX.household(c, d["household_id"])
        if d["status"] != "待顧問核准":
            return ok({"diff_id": diff_id, "status": d["status"], "note": "這筆差異先前已處理，沒有重複處理"})
        before_row, _ = _latest(c, d["household_id"])
        before = {z["zone"]: z["light_name"] for z in _evaluate(before_row, _meta(c, before_row["id"]))["zones"]}
        result = {"diff_id": diff_id, "household_id": d["household_id"], "decision": decision}
        if decision == "核准":
            v = d["new_value"]
            v = int(v) if float(v).is_integer() else v
            nid = _new_assessment(c, before_row, d["field"], v, "技師實測", None)
            new = c.execute("SELECT * FROM assessments WHERE id=?", (nid,)).fetchone()
            zones = _evaluate(new, _meta(c, nid))["zones"]
            changed = [{"zone": z["zone"], "before": before[z["zone"]], "after": z["light_name"]}
                       for z in zones if before[z["zone"]] != z["light_name"]]
            result.update(status="已核准", zones=zones, light_changes=changed,
                          next_step="燈號有變，請重新確認方案與報價，並請長輩本人再確認" if changed
                          else "燈號沒有變，照原方案施工")
        else:
            result.update(status="不核准", next_step="維持原量測與方案；請和技師確認現場狀況")
        c.execute("UPDATE site_diffs SET status=?, decided_by=?, decided_at=? WHERE id=?",
                  (result["status"], CTX.user_id, now(), diff_id))
    audit(NAME, "approve_site_difference", CTX, {"diff_id": diff_id, "decision": decision}, result["status"])
    return ok(result)


@mcp.resource("policy://risk-rules")
def risk_rules() -> str:
    """紅黃綠燈判斷規則全文（與原型相同）＋ v1.3 量測檢查規則。"""
    th, cor = rules.NEAR_CUTOFF["threshold_cm"], rules.NEAR_CUTOFF["corridor_cm"]
    return (
        "揪居家紅黃綠燈規則（示範用）\n"
        "紅燈要優先處理；黃燈建議改善；綠燈沒有明顯風險。\n"
        "浴室：門檻超過 3 cm 為紅燈（需設斜坡）；超過 0.5 cm 到 3 cm 為黃燈（建議斜角處理）；0.5 cm 以下為綠燈。\n"
        "走道：夜間偏暗，且走道窄於 80 cm 或路上有門檻，為紅燈；只有偏暗或只有偏窄為黃燈；其他為綠燈。\n"
        "臥室：床邊沒有插座或一晚起身兩次以上為黃燈。\n"
        "量測值超出合理範圍（走道 40–300 cm、門檻 0–30 cm、床邊到浴室 0.5–30 m、插座 0–10 個）時不判斷，需重新量測。\n"
        "量測檢查（v1.3，團隊設定，POC 實測誤差後修正）：\n"
        f"1. AR 掃描或參考卡照片的信心度低於 {rules.MIN_CONFIDENCE_PCT}% 不判斷，請重新量測或改用捲尺。\n"
        f"2. 門檻離分界（0.5 cm、3 cm）不到 {th[1]:g} cm、走道離 80 cm 不到 {cor[1]:g} cm：燈號照規則顯示，"
        "但標成需技師到府實測確認。\n"
        f"3. 材質辨識信心度低於 {rules.MATERIAL_MIN_PCT}%、兩個辨識結果不一致或家人還沒確認：{rules.SAFE_INSTALL}。\n"
        "4. 技師到府實測和 App 不同時回報差異，生活顧問核准後才更新燈號；方案送出後家人不能自行改量測。"
    )


@mcp.resource("policy://privacy")
def privacy() -> str:
    """隱私與同意規則。"""
    with db() as c:
        r = c.execute("SELECT title, body FROM kb WHERE uri='policy://privacy'").fetchone()
    return f"{r['title']}\n{r['body']}"


if __name__ == "__main__":
    mcp.run(transport="stdio")
