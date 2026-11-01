"""退回機制｜檢查兩次都沒通過時，改由程式直接從工具結果組出固定格式的回答。

這裡不經過 LLM，所以內容一定和工具結果一致；代價是語氣比較制式。
"""
from __future__ import annotations

from aguo.checks.evidence import Evidence

TAIL = "（這則回答由系統依查詢結果直接整理，細節請由生活顧問確認。）"


def _money(n) -> str:
    return f"{n:,} 元"


def _one(e: Evidence) -> str | None:
    d = e.data or {}
    t = e.tool
    if e.flagged_injection:
        return "查到的資料裡有疑似要改變系統規則的文字，系統沒有照做，已轉給生活顧問確認。"
    if not e.ok:
        return f"這一步沒有完成：{e.text}"
    if t == "assess_risk":
        s = d["summary"]
        reason = {z["zone"]: z["reason"] for z in d["zones"]}
        parts = []
        for name in ("紅燈", "黃燈", "尚未判斷"):
            if s.get(name):
                parts.append(f"{name}：" + "、".join(f"{z}（{reason[z]}）" for z in s[name]))
        if s.get("綠燈"):
            parts.append("綠燈：" + "、".join(s["綠燈"]))
        site = "、".join(d.get("needs_site_check") or [])
        return (f"依 {d['based_on_measurement']} 的量測，" + "；".join(parts) + "。"
                + (f"{site}的量測接近燈號分界，需技師到府確認。" if site else ""))
    if t == "get_ar_measures":
        m = "、".join(f"{x['label']} {x['value']} {x['unit']}" for x in d["measures"])
        bad = "、".join(x["label"] for x in d["invalid"] + d.get("low_confidence", []))
        return f"{d['measured_on']} 的 AR 量測：{m}。" + (f"需要重新量測：{bad}。" if bad else "")
    if t == "record_measurement":
        r = d["recorded"]
        s = f"已存成新的量測紀錄：{r['label']} {r['value']} {r['unit']}（{r['source']}）。"
        if not d["usable_for_assessment"]:
            s += "這筆信心度不足，還不能拿來判斷燈號。"
        if d["needs_site_check"]:
            s += "數值接近燈號分界，需技師到府確認。"
        return s
    if t == "report_site_difference":
        if "diff_id" not in d:
            return d["note"] + "。"
        return (f"已回報差異 {d['diff_id']}：{d['label']}由 {d['old_value']} 改為實測 {d['new_value']} {d['unit']}，"
                f"狀態：{d['status']}。")
    if t == "approve_site_difference":
        if "note" in d:
            return d["note"] + "。"
        if d["status"] == "已核准":
            ch = "、".join(f"{x['zone']}由{x['before']}變{x['after']}" for x in d["light_changes"]) or "燈號沒有改變"
            return f"差異 {d['diff_id']} 已核准，改用技師實測值：{ch}。{d['next_step']}。"
        return f"差異 {d['diff_id']} 不核准，{d['next_step']}。"
    if t == "recommend_options":
        o = "；".join(f"{x['tier']}「{x['name']}」" + (f" {_money(x['price_twd'])}" if x["price_twd"] is not None
                                                     else " 需到府估價") + ("（推薦）" if x["recommended"] else "")
                     for x in d["options"])
        return f"{d['zone']}可以這樣改善：{o}。"
    if t == "estimate_quote":
        p = "；另有待估價：" + "、".join(x["name"] for x in d["pending_estimate"]) if d["pending_estimate"] else ""
        mo = f"，關懷月費 {_money(d['monthly_fee_twd'])}" if d["monthly_fee_twd"] else ""
        return f"試算：一次付清 {_money(d['one_time_total_twd'])}{mo}{p}。"
    if t == "submit_to_advisor":
        return f"方案已送出，案件狀態：{d['status']}。" if "note" not in d else d["note"] + "。"
    if t == "get_case_status":
        w = "；".join(f"{x['day']} {x['time']} {x['staff']}" for x in d["work_orders"])
        return f"{d['household']}目前狀態：{d['status']}。" + (f"已排定：{w}。" if w else "")
    if t == "record_elder_consent":
        return f"已記錄長輩本人的決定：{d['decision']}（{d['method']}），案件狀態：{d['status']}。"
    if t == "find_available_staff":
        r = d.get("recommendation")
        if not r:
            return f"{d['day']} 沒有符合條件的人力" + (f"，最近可安排的日期是 {d['next_available_day']}。"
                                                    if d.get("next_available_day") else "。")
        crews = "、".join(f"{c['staff']} {c['time']}" for c in r["crews"])
        s = f"{d['day']} 推薦：" + (f"協力工班 {crews} 先施工，" if crews else "") + \
            f"全國電子技師 {r['tech']['staff']} {r['tech']['time']} 安裝。"
        if d.get("consent_note"):
            s += d["consent_note"] + "。"
        return s
    if t == "assign_work_package":
        w = "；".join(f"{x['day']} {x['time']} {x['staff']}" for x in d["work_orders"])
        return f"已派工：{w}。"
    if t == "get_night_events":
        if d["no_event"]:
            return f"{d['night']} 這一晚沒有夜間事件紀錄。"
        return "；".join(f"{e['timeline'][0][0]} 起的事件判斷為「{e['status']}」，{e['next_action']}" for e in d["events"]) + "。"
    if t == "get_care_events":
        if d["no_event"]:
            return f"{d['day']} 這一天沒有白天關懷事件紀錄。"
        return "；".join(f"{e['kind']}（{e['timeline'][0][0]}）判斷為「{e['status']}」，{e['next_action']}" for e in d["events"]) + "。"
    if t == "get_appliance_profile":
        if d["no_record"]:
            return "這個家庭的家電檔案還沒有登錄資料。"
        parts = []
        for x in d["appliances"]:
            w = f"保固到 {x['warranty_until']}" if x["warranty_until"] else x["warranty_status"]
            m = f"，下次保養 {x['next_maintenance']}（{x['maintenance']}）" if x["next_maintenance"] else ""
            parts.append(f"{x['name']}：{w}{m}")
        return "家電檔案：" + "；".join(parts) + "。"
    if t == "get_maintenance_due":
        if not d["count"]:
            return f"未來 {d['within_days']} 天內沒有要保養或保固到期的家電。"
        return f"未來 {d['within_days']} 天內要提醒的家電：" + "；".join(
            f"{x['household']}{x['name']}（{'、'.join(x['reasons'])}，{x['next_maintenance'] or x['warranty_until']}）"
            for x in d["due"]) + "。"
    if t == "book_maintenance":
        if "note" in d:
            return d["note"] + f"（{d['day']}，{d['status']}）。"
        return f"已預約保養：{d['appliance']}，{d['day']}，狀態：{d['status']}。"
    if t == "get_scene_plan":
        if not d["available"]:
            return f"{d['scene']}（{d['scope']}）目前尚未開放：{d['what_to_say']}。"
        return (f"{d['scene']}（{d['scope']}）：設定費 {_money(d['setup_fee_twd'])}，月費 {_money(d['monthly_fee_twd'])}；"
                + "；".join(d["care_rules"]) + "。")
    if t == "notify_family":
        return d.get("note", f"已通知 {d.get('notified')}（{d.get('channel')}）") + "。"
    if t == "get_home_profile":
        return f"{d['household']}：{d['elder']}，{d['store']}。"
    if t == "find_store_products":
        ps = "；".join(f"{x['name']}（貨號 {x['sku']}，" + (f"{_money(x['price_twd'])}" if x["price_twd"] is not None
                                                          else "售價未查得") + f"，{x['status']}）" for x in d["products"])
        gs = "、".join(g["item"] for g in d["not_found_on_site"])
        return (f"全國電子官網（{d['query_date']} 查詢）符合的商品：{ps or '沒有'}。"
                + (f"官網查不到：{gs}。" if gs else "") + "售價以門市為準。")
    if t == "read_policy":
        return e.text[:300]
    if t == "check_stock":
        return f"{d['store']}{d.get('name', d['sku'])} 庫存 {d['qty']}。"
    return None


def build(evidence: list[Evidence], turn_start: int) -> str:
    lines = [s for e in evidence[turn_start:] if (s := _one(e))]
    if not lines:
        return "這個問題我沒有查到可以佐證的資料，已轉給生活顧問確認。"
    return "\n".join(dict.fromkeys(lines)) + "\n" + TAIL
