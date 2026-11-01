"""揪居家規則（與原型 v6 一致的確定性計算）。

所有燈號、金額、派工推薦都在這裡用程式算，LLM 只負責解釋。
規則來源：GitHub 原型 KY0126/Innovation-Design 的 jiujujia/backend.js、consultant.html、app.html（示範資料）。
"""
from __future__ import annotations

import calendar
import json
import math
import os
from datetime import date, timedelta
from pathlib import Path

# ---- 規則資料檔：優先讀 jiujujia-app 的共用規則檔（#4 建好後），沒有就讀 knowledge/risk-rules.json ----
_AGENT_ROOT = Path(__file__).resolve().parent.parent
_SHARED = _AGENT_ROOT.parent / "jiujujia-app" / "lib" / "shared" / "data" / "risk-rules.json"
RULES_PATH = Path(os.environ.get("AGUO_RISK_RULES") or (_SHARED if _SHARED.exists() else
                                                         _AGENT_ROOT / "knowledge" / "risk-rules.json"))
RULES = json.loads(RULES_PATH.read_text("utf-8"))

# ---- 問卷選項（與原型相同） ----
QUESTIONS = {
    "live": ["剛開始一個人住", "一個人住超過一年", "和家人同住"],
    "night": ["不會", "一晚一次", "一晚兩次以上", "不清楚"],
    "light": ["夠亮", "偏暗", "不清楚"],
    "phone": ["會用 LINE", "只會接電話", "幾乎不用"],
    "worry": ["夜間跌倒沒人知道", "忘記關火或用電安全", "身體不舒服沒人發現", "接到詐騙電話"],
}

# ---- AR 量測欄位：名稱、單位、合理範圍（與原型相同） ----
MEASURES = {k: (v["label"], v["unit"], v["min"], v["max"]) for k, v in RULES["measures"].items()}

LIGHT_NAME = {k: v["name"] for k, v in RULES["lights"].items()}
LIGHT_MEANING = {k: v["meaning"] for k, v in RULES["lights"].items()}
_BATH = RULES["zones"]["bathroom"]
_COR = RULES["zones"]["corridor"]

# ---- 揪夜安關懷方案（與原型相同） ----
CARE_KIT = {
    "night": {"name": "夜間動線照明", "detail": "感應小夜燈 3、門窗感測器 2、浴室緊急按鈕 1、閘道器 1", "price": 3600},
    "strip": {"name": "門檻提示燈條", "detail": "浴室門檻高於 0.5 cm 時加裝，夜間標出高低差", "price": 800},
}
SETUP_FEE = 1500
MONTHLY_FEE = {"揪夜安": 299}
ANNUAL_MONTHS = 10  # 原型：年繳 = 月費 × 10

# ---- 夜間關懷規則（與原型 App「關懷規則」頁相同） ----
_CARE = RULES["care"]
CARE_RULES = {
    "bath_stay_min": _CARE["bath_stay_min"],                    # 浴室停留超過 → 第 1 次詢問：燈光閃爍、語音詢問長輩
    "elder_no_response_min": _CARE["elder_no_response_min"],    # 第 1 次詢問沒回應 → 第 2 次詢問：撥打家中電話
    "family_no_response_min": _CARE["family_no_response_min"],  # 家人沒回應 → 通知下一位
    "sensor_offline_min": _CARE["sensor_offline_min"],          # 感測器沒回傳 → 通知家人與門市（設備問題）
}


def validate_measures(raw: dict) -> tuple[dict, list[dict]]:
    """回傳（合格量測值, 異常清單）。超出範圍的值不拿來判斷，改列為需重新量測。"""
    ok, bad = {}, []
    for key, (label, unit, lo, hi) in MEASURES.items():
        if key not in raw or raw[key] is None:
            continue
        v = raw[key]
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            bad.append({"field": key, "label": label, "value": v, "unit": unit,
                        "problem": "量測值格式不正確，需要重新量測"})
            continue
        if v < lo or v > hi:
            bad.append({"field": key, "label": label, "value": v, "unit": unit,
                        "problem": f"超出合理範圍 {lo}–{hi} {unit}，可能是單位填錯，需要重新量測"})
            continue
        if key == "outlets":
            ok[key] = int(math.floor(float(v) + 0.5))
        else:
            # 與原型 JavaScript 的 Math.round(x*10)/10 相同（.5 一律進位）；
            # 不用 Python round()：round(3.05, 1) 會得到 3.0，讓紅燈變黃燈（流程測試 T21 抓到）
            r = math.floor(float(v) * 10 + 0.5) / 10
            ok[key] = int(r) if r.is_integer() else r
    return ok, bad


# ---- v1.3：量測來源、信心度與分界附近的現場確認 ----
# 量測從哪裡來（App 的 AR 掃描、參考卡照片量測、家人用捲尺手動輸入、技師到府實測）
SOURCES = ("AR 掃描", "參考卡照片", "家人手動輸入", "技師實測")
_MC = RULES["measurement_checks"]
MIN_CONFIDENCE_PCT = _MC["min_confidence_pct"]   # AR／參考卡信心度低於這個值：不拿來判斷，請重新量測
# 量到的值離燈號分界太近時，手機量測的誤差可能讓燈號判斷錯：標成「需技師到府確認」，燈號照規則算、不自行改
NEAR_CUTOFF = {k: (tuple(v["cutoffs"]), v["tolerance"]) for k, v in _MC["near_cutoff"].items()}
# 材質辨識只能從固定清單選；安裝方式由程式對照，不讓模型自己寫
MATERIAL_OPTIONS = RULES["materials"]["options"]
MATERIAL_INSTALL = {(x["part"], x["material"]): x["install"] for x in RULES["materials"]["install"]}
MATERIAL_MIN_PCT = _MC["material_min_pct"]   # 材質信心度低於這個值，或兩個辨識結果不一致：請家人確認
SAFE_INSTALL = _MC["safe_install"]


def apply_sources(valid: dict, sources: dict) -> tuple[dict, list[dict], list[dict]]:
    """回傳（可判斷的量測值, 信心度不足清單, 分界附近需現場確認清單）。sources：欄位 → {source, confidence_pct}。"""
    usable, low, near = dict(valid), [], []
    for key, v in valid.items():
        src = (sources or {}).get(key) or {}
        kind, conf = src.get("source", "AR 掃描"), src.get("confidence_pct")
        label, unit = MEASURES[key][0], MEASURES[key][1]
        if kind in ("AR 掃描", "參考卡照片") and conf is not None and conf < MIN_CONFIDENCE_PCT:
            usable.pop(key)
            low.append({"field": key, "label": label, "value": v, "unit": unit, "source": kind,
                        "confidence_pct": conf,
                        "problem": f"{kind}信心度 {conf}% 低於 {MIN_CONFIDENCE_PCT}%，需要重新量測或改用捲尺手動輸入"})
            continue
        if key in NEAR_CUTOFF and kind != "技師實測":
            cuts, tol = NEAR_CUTOFF[key]
            hit = [c for c in cuts if abs(v - c) < tol]   # 嚴格小於：剛好差一個容忍值（例如門檻 0 cm）不標
            if hit:
                near.append({"field": key, "label": label, "value": v, "unit": unit, "source": kind,
                             "cutoff": hit[0], "tolerance": tol,
                             "note": f"{label} {v:g} {unit} 離燈號分界 {hit[0]:g} {unit} 不到 {tol:g} {unit}，"
                                     "手機量測可能有誤差，需技師到府實測確認；燈號先照規則顯示"})
    return usable, low, near


def check_materials(materials: list[dict]) -> list[dict]:
    """材質辨識的兩道檢查：信心度與兩個辨識結果（手機上的分類器、雲端視覺模型）是否一致；家人確認後才帶入安裝方式。"""
    out = []
    for m in materials or []:
        m = dict(m)
        pct = m.get("ai_confidence_pct")
        second = m.get("second_check")          # 視覺模型的結果（只是第二意見）
        issues = []
        if m.get("part") in MATERIAL_OPTIONS and m.get("material") not in MATERIAL_OPTIONS[m["part"]]:
            issues.append(f"「{m.get('material')}」不在{m['part']}的材質清單內")
        if pct is not None and pct < MATERIAL_MIN_PCT:
            issues.append(f"辨識信心度 {pct}% 低於 {MATERIAL_MIN_PCT}%")
        if second and second != m.get("material"):
            issues.append(f"兩個辨識結果不一致（{m.get('material')}／{second}）")
        if not m.get("family_confirmed"):
            issues.append("家人還沒確認")
        m["check"] = "可帶入" if not issues else "待確認：" + "、".join(issues)
        if issues:
            m["install_note"] = SAFE_INSTALL
        out.append(m)
    return out


def assess(answers: dict, measures: dict) -> list[dict]:
    """各區燈號，邏輯與原型 backend.js 的 assess() 完全相同。"""
    has = lambda k: measures.get(k) is not None  # noqa: E731
    out = []
    # 臥室
    if has("outlets") and measures["outlets"] == 0:
        out.append(("臥室", "y", "床邊沒有插座，改用電池型夜燈"))
    elif answers.get("night") == "一晚兩次以上":
        out.append(("臥室", "y", "夜間起身頻繁"))
    else:
        out.append(("臥室", "g", "無明顯風險"))
    # 走道
    dark = answers.get("light") != "夠亮"
    narrow = has("corridor_cm") and measures["corridor_cm"] < _COR["narrow_below_cm"]
    th = has("threshold_cm") and measures["threshold_cm"] > _COR["path_threshold_above_cm"]
    why = "、".join(x for x in [
        "夜間偏暗" if dark else "",
        f"走道約 {measures['corridor_cm']} cm 偏窄" if narrow else "",
        "路上有門檻" if th else "",
    ] if x)
    light = "r" if dark and (narrow or th) else ("y" if dark or narrow else "g")
    out.append(("走道", light, why or "照明足夠"))
    # 浴室
    if has("threshold_cm"):
        t = measures["threshold_cm"]
        red, yellow = _BATH["threshold_red_above_cm"], _BATH["threshold_yellow_above_cm"]
        if t > red:
            out.append(("浴室", "r", f"門檻約 {t:g} cm，超過 {red:g} cm 需設斜坡"))
        elif t > yellow:
            out.append(("浴室", "y", f"門檻約 {t:g} cm，建議斜角處理"))
        else:
            out.append(("浴室", "g", f"門檻 {yellow:g} cm 以下"))
    else:
        out.append(("浴室", "n", "門檻尚未量測"))
    # 廚房、客廳、門口
    if answers.get("worry") == "忘記關火或用電安全":
        out.append(("廚房", "y", "擔心忘記關火（揪食光，擴展期）"))
    else:
        out.append(("廚房", "g", "無明顯風險"))
    if answers.get("phone") == "幾乎不用":
        out.append(("客廳", "y", "長輩少用手機，詢問改撥家中電話"))
    else:
        out.append(("客廳", "g", "無明顯風險"))
    out.append(("門口", "g", "無明顯風險"))
    return [{"zone": z, "light": l, "light_name": LIGHT_NAME[l], "meaning": LIGHT_MEANING[l], "reason": r}
            for z, l, r in out]


FIELD_ZONES = {"corridor_cm": ["走道"], "threshold_cm": ["浴室", "走道"], "outlets": ["臥室"], "bed_bath_m": []}


def evaluate(answers: dict, raw_measures: dict, sources: dict | None = None) -> dict:
    """完整判斷（MCP 工具與 assess 能力共用同一段）：範圍檢查 → 信心度 → 分界附近 → 燈號。"""
    valid, invalid = validate_measures(raw_measures)
    usable, low, near = apply_sources(valid, sources or {})
    zones = assess(answers, usable)
    unusable = {b["field"] for b in invalid} | {b["field"] for b in low}
    for z in zones:
        if (z["zone"] == "走道" and "corridor_cm" in unusable) or (z["zone"] == "浴室" and "threshold_cm" in unusable):
            z.update(light="n", light_name=LIGHT_NAME["n"], meaning=LIGHT_MEANING["n"],
                     reason="量測值異常或信心度不足，需要重新量測後才能判斷")
        elif z["zone"] == "走道" and "threshold_cm" not in usable and z["light"] != "r":
            z["pending_note"] = "門檻還沒有可用的量測值；量到後，走道可能變成紅燈"
        for n in near:
            if z["zone"] in FIELD_ZONES[n["field"]] and not (z["zone"] == "走道" and n["field"] == "threshold_cm"
                                                             and n["cutoff"] != _COR["path_threshold_above_cm"]):
                z["needs_site_check"] = True
                z["site_check_note"] = n["note"]
    return {"valid": valid, "usable": usable, "invalid": invalid, "low": low, "near": near, "zones": zones}


def care_kit_items(measures: dict) -> list[dict]:
    items = [dict(id="night", **CARE_KIT["night"])]
    if measures.get("threshold_cm") is not None and measures["threshold_cm"] > 0.5:
        items.append(dict(id="strip", **CARE_KIT["strip"]))
    return items


def quote(options: list[dict], kit: list[dict] | None) -> dict:
    """整合報價：與原型顧問端相同——揪夜安設備＋設定費＋已定價改善項目；待估價項目不計入。"""
    priced = [o for o in options if o["price"] is not None]
    pending = [o for o in options if o["price"] is None]
    kit = kit or []
    kit_total = sum(k["price"] for k in kit)
    setup = SETUP_FEE if kit else 0
    options_total = sum(o["price"] for o in priced)
    monthly = MONTHLY_FEE["揪夜安"] if kit else 0
    return {
        "care_plan": "揪夜安｜單一場域關懷" if kit else "不加購",
        "care_kit": [{"name": k["name"], "detail": k["detail"], "price_twd": k["price"]} for k in kit],
        "setup_fee_twd": setup,
        "options": [{"option_id": o["id"], "zone": o["zone"], "name": o["name"], "price_twd": o["price"],
                     "installed_by": o["by_team"]} for o in priced],
        "pending_estimate": [{"option_id": o["id"], "zone": o["zone"], "name": o["name"],
                              "note": "需到府估價，不套用示範價格"} for o in pending],
        "one_time_total_twd": kit_total + setup + options_total,
        "monthly_fee_twd": monthly,
        "annual_fee_twd": monthly * ANNUAL_MONTHS,
        "payment": "設備與設定費一次付清；關懷月費以場域計價，兄弟姊妹可以分攤" if kit else "一次付清",
        "is_demo_price": True,
    }


def _min(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _hhmm(n: int) -> str:
    return f"{n // 60:02d}:{n % 60:02d}"


def evaluate_night(ev: dict, elder: str) -> dict:
    """夜間事件判斷，與提案書 3.1 及原型 App「關懷規則」相同：
    第 1 次詢問用燈光與語音；5 分鐘沒回應，第 2 次詢問撥打家中電話；兩次都沒回應才通知家人。
    ev["elder_reply"]：None＝兩次都沒回應；"燈光語音"＝第 1 次就按「我很好」；"家中電話"＝第 2 次接起電話。"""
    r = CARE_RULES
    tl = [[ev["enter_bath"], f"{elder}進入浴室"]]
    if ev["leave_bath"]:
        stay = _min(ev["leave_bath"]) - _min(ev["enter_bath"])
        tl.append([ev["leave_bath"], f"回到臥室（浴室停留 {stay} 分鐘）"])
        return {"timeline": tl, "status": "正常起夜", "next_action": "不需要處理", "asks": 0}
    ask = _min(ev["asked_at"])
    call = _hhmm(ask + r["elder_no_response_min"])
    tl.append([ev["asked_at"], f"浴室停留超過 {r['bath_stay_min']} 分鐘，第 1 次詢問：燈光閃爍、語音詢問{elder}"])
    reply = ev["elder_reply"]
    if reply == "燈光語音":
        tl.append([_hhmm(ask + 1), f"{elder}按下「我很好」，流程結束"])
        return {"timeline": tl, "status": "長輩已回覆平安", "asks": 1,
                "next_action": "流程結束，隔天由生活顧問電話關心即可"}
    tl.append([call, f"{elder} {r['elder_no_response_min']} 分鐘未回應，第 2 次詢問：撥打家中電話"])
    if reply == "家中電話":
        tl.append([_hhmm(ask + r["elder_no_response_min"] + 1), f"{elder}接起家中電話，回覆平安，流程結束"])
        return {"timeline": tl, "status": "長輩已回覆平安", "asks": 2,
                "next_action": "流程結束，隔天由生活顧問電話關心即可"}
    tl.append([call, "家中電話無人接聽，兩次詢問都沒有回應"])
    return {"timeline": tl, "status": "需通知家人", "asks": 2,
            "next_action": "依聯絡順序通知家人（LINE＋語音電話），由家人判斷是否需要協助"}


# ---- v1.3：晨起確認與感測器離線（揪夜安，五場域方案總表 ①） ----
MORNING_CHECK = _CARE["morning_check"]   # 早上 10:00 還沒有任何活動 → 先語音詢問長輩，5 分鐘沒回應撥家中電話，兩次都沒回應才通知家人


def evaluate_care(ev: dict, elder: str) -> dict:
    """白天關懷事件：晨起確認、感測器離線。異常一樣先問長輩兩次，沒回應才通知家人；設備問題不當成長輩出事。"""
    r = CARE_RULES
    if ev["kind"] == "感測器離線":
        tl = [[ev["asked_at"], f"{ev['sensor']}沒有回傳訊號"]]
        if ev["offline_min"] < r["sensor_offline_min"]:
            tl.append([_hhmm(_min(ev["asked_at"]) + ev["offline_min"]), f"{ev['offline_min']} 分鐘後恢復"])
            return {"kind": ev["kind"], "timeline": tl, "status": "訊號短暫中斷，已恢復", "asks": 0,
                    "next_action": "不需要處理"}
        tl.append([_hhmm(_min(ev["asked_at"]) + r["sensor_offline_min"]),
                   f"超過 {r['sensor_offline_min']} 分鐘沒有回傳，判斷為設備問題"])
        return {"kind": ev["kind"], "timeline": tl, "status": "設備離線", "asks": 0,
                "next_action": "請門市安排檢修；通知家人時說明這是設備問題，不代表長輩有狀況"}
    # 晨起確認
    if ev["first_activity"] and _min(ev["first_activity"]) <= _min(MORNING_CHECK):
        return {"kind": ev["kind"], "timeline": [[ev["first_activity"], f"{elder}起床活動（{ev['sensor']}）"]],
                "status": "正常作息", "asks": 0, "next_action": "不需要處理"}
    ask = _min(MORNING_CHECK)
    tl = [[MORNING_CHECK, f"到 {MORNING_CHECK} 還沒有活動，第 1 次詢問：語音詢問{elder}"]]
    reply = ev["elder_reply"]
    if reply == "燈光語音":
        tl.append([_hhmm(ask + 1), f"{elder}按下「我很好」，流程結束"])
        return {"kind": ev["kind"], "timeline": tl, "status": "長輩已回覆平安", "asks": 1,
                "next_action": "流程結束，生活顧問下次電話關心時順便問睡眠狀況"}
    tl.append([_hhmm(ask + r["elder_no_response_min"]),
               f"{elder} {r['elder_no_response_min']} 分鐘未回應，第 2 次詢問：撥打家中電話"])
    if reply == "家中電話":
        tl.append([_hhmm(ask + r["elder_no_response_min"] + 1), f"{elder}接起家中電話，回覆平安，流程結束"])
        return {"kind": ev["kind"], "timeline": tl, "status": "長輩已回覆平安", "asks": 2,
                "next_action": "流程結束，生活顧問下次電話關心時順便問睡眠狀況"}
    tl.append([_hhmm(ask + r["elder_no_response_min"]), "家中電話無人接聽，兩次詢問都沒有回應"])
    return {"kind": ev["kind"], "timeline": tl, "status": "需通知家人", "asks": 2,
            "next_action": "依聯絡順序通知家人（LINE＋語音電話），由家人判斷是否需要協助"}


# ---- v1.3：長照居家無障礙環境改善給付對照（五場域方案總表；團隊整理，是否符合由照管專員評估） ----
LTC_RULE = {"cap_twd": 40000, "years": 3, "copay_general_pct": 30}
SUBSIDY = {
    "FA03": ("斜坡板", 3500), "FA08": ("防滑條", 3000), "FA10": ("防滑工程", 3000), "FA11": ("無障礙門片", 7000),
}
OPTION_SUBSIDY = {"H2": ["FA10"], "B1": ["FA03"], "B2": ["FA03", "FA10"], "B3": ["FA10"], "D3": ["FA11"]}


def subsidy_for(option_id: str) -> list[dict]:
    return [{"code": k, "item": SUBSIDY[k][0], "cap_twd": SUBSIDY[k][1]} for k in OPTION_SUBSIDY.get(option_id, [])]


# ---- v1.3：家電檔案（保固與保養週期） ----
def add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    y += d.year
    return date(y, m + 1, min(d.day, calendar.monthrange(y, m + 1)[1]))


def appliance_status(a: dict, today: date) -> dict:
    """依安裝日、保固月數、保養週期算出保固到期日與下次保養日。保固月數沒有資料時寫「保固資料待補」，不自己猜。"""
    inst = date.fromisoformat(a["installed_on"])
    out = {"warranty_until": None, "warranty_status": "保固資料待補"}
    if a.get("warranty_months"):
        wu = add_months(inst, a["warranty_months"])
        out = {"warranty_until": wu.isoformat(), "warranty_status": "保固中" if wu >= today else "已過保固"}
    nxt = None
    if a.get("cycle_months"):
        nxt = add_months(date.fromisoformat(a["last_done"]) if a.get("last_done") else inst, a["cycle_months"])
        overdue = nxt < today
        out["maintenance_overdue"] = overdue
    out["next_maintenance"] = nxt.isoformat() if nxt else None
    out["days_until_maintenance"] = (nxt - today).days if nxt else None
    return out


def work_packages(options: list[dict], with_kit: bool) -> dict:
    """把選好的做法拆成工作包：協力工班先施工，全國電子技師後安裝。"""
    crew = {}
    tech = []
    for o in options:
        if o["by_team"].startswith("協力工班"):
            crew.setdefault(o["skill"], []).append(o["name"])
        elif o["by_team"] == "全國電子技師":
            tech.append(o["name"])
    if with_kit:
        tech.append("揪夜安關懷設備安裝")
    return {"crew_jobs": [{"skill": k, "items": v} for k, v in crew.items()], "tech_items": tech}
