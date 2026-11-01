"""檢查一｜權限與流程守門（程式判斷，不交給 AI）。

Server 端也會再檢查一次（雙重保險）：Host 擋下就不會送出呼叫；就算 Host 漏了，Server 也會拒絕。
"""
from __future__ import annotations

import re

ALL = {"family", "advisor", "hq"}
WITH_TECH = ALL | {"tech"}   # v1.3：技師只看手上有工單的家庭（Server 端再檢查）
TOOL_ROLES = {
    "get_home_profile": WITH_TECH, "get_ar_measures": WITH_TECH, "assess_risk": WITH_TECH,
    "recommend_options": ALL, "check_stock": ALL, "estimate_quote": ALL, "find_store_products": ALL,
    "get_case_status": WITH_TECH, "get_night_events": ALL, "read_policy": WITH_TECH,
    "get_care_events": ALL, "get_appliance_profile": ALL, "get_scene_plan": ALL,
    "get_maintenance_due": {"advisor", "hq"},
    "book_maintenance": {"family"},
    "record_measurement": {"family"},
    "report_site_difference": {"tech"},
    "approve_site_difference": {"advisor"},
    "submit_to_advisor": {"family"},
    "record_elder_consent": {"advisor"},
    "find_available_staff": {"advisor"},
    "assign_work_package": {"advisor"},
    "notify_family": {"advisor", "hq"},
}
MUTATING_TOOLS = {"submit_to_advisor", "record_elder_consent", "assign_work_package", "notify_family",
                  "record_measurement", "report_site_difference", "approve_site_difference", "book_maintenance"}
ROLE_NAME = {"family": "家人", "advisor": "生活顧問", "hq": "總部", "tech": "技師"}

# 疑似提示詞注入：出現在工具結果或資料裡的「指令」
INJECTION = re.compile(
    r"(忽略|無視|不要理會).{0,8}(規則|指示|指令|設定)|【?\s*(系統指示|給\s*AI\s*的)|ignore (all|previous|the above)|"
    r"system prompt|你現在是|列出所有(家庭|顧客|使用者)", re.I)


def describe(tool: str, args: dict) -> str:
    """把會改變狀態的動作翻成白話，給使用者確認。"""
    if tool == "submit_to_advisor":
        return f"把 {args.get('household_id')} 的方案（{'、'.join(args.get('option_ids') or [])}）送給生活顧問"
    if tool == "record_elder_consent":
        return f"記錄長輩本人對案件 {args.get('case_id')} 的決定：{args.get('decision')}（{args.get('method')}）"
    if tool == "assign_work_package":
        crews = "、".join(args.get("crew_ids") or []) or "無"
        return f"為案件 {args.get('case_id')} 派工：{args.get('day')}，協力工班 {crews}，技師 {args.get('tech_id')}"
    if tool == "notify_family":
        return f"通知 {args.get('household_id')} 的家人：「{args.get('message')}」"
    if tool == "book_maintenance":
        return f"幫 {args.get('household_id')} 預約保養：{args.get('appliance_id')}，{args.get('day')}"
    if tool == "record_measurement":
        conf = f"，信心度 {args.get('confidence_pct')}%" if args.get("confidence_pct") is not None else ""
        return f"幫 {args.get('household_id')} 存一筆新量測：{args.get('field')} = {args.get('value')}（{args.get('source')}{conf}）"
    if tool == "report_site_difference":
        return f"回報 {args.get('household_id')} 的現場差異：{args.get('field')} 實測 {args.get('value')}，送生活顧問核准"
    if tool == "approve_site_difference":
        return f"對差異 {args.get('diff_id')} 做出決定：{args.get('decision')}"
    return f"{tool} {args}"


def check(role: str, tool: str, args: dict, known_tools: set[str], schema: dict | None = None) -> str | None:
    """回傳 None 代表可以呼叫；否則回傳拒絕原因（會原樣交給 AI，AI 必須如實告訴使用者）。"""
    if tool not in known_tools:
        return f"系統沒有「{tool}」這個工具，請改用清單中的工具。"
    if "__unparsable__" in args:
        return "工具參數不是正確的 JSON，請重新呼叫。"
    if schema is not None and (errs := type_errors(args, schema)):
        return "參數型別錯誤：" + "；".join(errs) + "。這個動作沒有執行。"
    if role not in TOOL_ROLES.get(tool, set()):
        return f"權限不足：{ROLE_NAME.get(role, role)}不能執行「{tool}」。這個動作沒有執行。"
    for v in args.values():
        if isinstance(v, str) and INJECTION.search(v):
            return "參數裡有疑似要改變系統規則的文字，已拒絕執行。"
    return None


def _types(prop: dict) -> set[str]:
    ts = set()
    for p in [prop, *prop.get("anyOf", []), *prop.get("oneOf", [])]:
        t = p.get("type")
        ts.update(t if isinstance(t, list) else [t] if t else [])
    return ts


def type_errors(args: dict, schema: dict | None) -> list[str]:
    """參數型別要嚴格：數字、整數、布林欄位傳成字串（"76"、"False"）一律拒絕，不讓工具自動轉型。"""
    props = (schema or {}).get("properties") or {}
    errs = []
    for k, v in args.items():
        ts = _types(props.get(k, {}))
        if isinstance(v, str) and ts & {"number", "integer", "boolean"} and "string" not in ts:
            errs.append(f"{k} 要是{'布林值' if 'boolean' in ts else '數字'}，不能是文字 {v!r}")
        elif isinstance(v, bool) and ts & {"number", "integer"} and "boolean" not in ts:
            errs.append(f"{k} 要是數字，不能是布林值 {v!r}")
    return errs


def scan_injection(text: str) -> bool:
    return bool(INJECTION.search(text or ""))
