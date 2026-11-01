"""檢查二｜證據比對（程式判斷）。

回答裡的數字、單位、燈號、人名、日期時間、以及「已完成」的說法，都必須在這次對話的工具結果中找得到。
差一個字就不通過——寧可退回重寫或改用固定版本，也不讓沒有根據的內容送到使用者面前。
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

UNIT = {"cm": "cm", "公分": "cm", "m": "m", "公尺": "m", "米": "m", "元": "元", "塊": "元", "%": "%",
        "分鐘": "分鐘", "萬元": "萬元", "萬": "萬元"}
STRICT_UNITS = {"cm", "m", "元", "%", "分鐘", "萬元"}
KEY_UNIT = {"_twd": "元", "_cm": "cm", "_m": "m", "_pct": "%", "_min": "分鐘"}
ZONES = ["浴室門", "走道", "浴室", "臥室", "廚房", "客廳", "門口"]
LIGHTS = ["紅燈", "黃燈", "綠燈"]

NUM_UNIT = re.compile(r"(NT\$\s*)?(\d[\d,]*(?:\.\d+)?)\s*(公分|公尺|分鐘|萬元|萬|cm|元|塊|%|米|m(?![a-zA-Z]))?")
TIME = re.compile(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)")
DATE_ISO = re.compile(r"(\d{4})-(\d{1,2})-(\d{1,2})")
DATE_MD = re.compile(r"(?<![\d/])(\d{1,2})\s*(?:/|月)\s*(\d{1,2})\s*(?:日|號)?(?![\d/])")
LIST_MARK = re.compile(r"(^|\n)\s*(\d{1,2})[.、)）]\s")
CLAIMS = [  # （說法, 需要的證據）
    (re.compile(r"(已|已經)[^，。；不沒未]{0,3}(更新|存好|存入|記錄|核准|回報).{0,6}(量測|差異|實測|門檻|走道)"), "measured"),
    (re.compile(r"(已|已經)[^，。；不沒未]{0,3}(預約|約好|排好).{0,4}(保養|清洗|檢查)"), "booked"),
    (re.compile(r"(已|已經)[^，。；不沒未]{0,3}(送出|送給|送交)"), "submitted"),
    (re.compile(r"(已|已經)[^，。；不沒未]{0,3}(派工|排定|安排好|完成派工|派給)"), "assigned"),
    (re.compile(r"(已|已經)[^，。；不沒未]{0,3}(通知|發送通知|傳送通知)"), "notified"),
    (re.compile(r"(已|已經)[^，。；不沒未]{0,3}(記錄|取得|確認).{0,6}同意|長輩.{0,4}已(經)?同意|(當面|電話)同意了"), "consented"),
]


@dataclass
class Evidence:
    id: str
    tool: str
    args: dict
    ok: bool
    text: str
    data: dict | None = None
    flagged_injection: bool = False


@dataclass
class Facts:
    pairs: set = field(default_factory=set)
    nums: set = field(default_factory=set)
    times: set = field(default_factory=set)
    dates: set = field(default_factory=set)
    lights: dict = field(default_factory=dict)
    prev_lights: set = field(default_factory=set)   # v1.3：核准差異前的燈號（「浴室由黃燈變紅燈」的「黃燈」）
    text: str = ""
    states: set = field(default_factory=set)


def _n(s: str) -> float:
    return float(s.replace(",", ""))


def _scan_text(s: str, f: Facts) -> None:
    for m in TIME.finditer(s):
        f.times.add((int(m.group(1)), int(m.group(2))))
    for m in DATE_ISO.finditer(s):
        f.dates.add((int(m.group(2)), int(m.group(3))))
        f.nums.update({float(m.group(1)), float(m.group(2)), float(m.group(3))})
    for m in NUM_UNIT.finditer(s):
        v = _n(m.group(2))
        f.nums.add(v)
        unit = "元" if m.group(1) else UNIT.get(m.group(3) or "")
        if unit:
            f.pairs.add((v, unit))


def _walk(key: str, v, f: Facts) -> None:
    if isinstance(v, bool) or v is None:
        return
    if isinstance(v, (int, float)):
        f.nums.add(float(v))
        for suf, unit in KEY_UNIT.items():
            if key.endswith(suf):
                f.pairs.add((float(v), unit))
    elif isinstance(v, str):
        _scan_text(v, f)
    elif isinstance(v, list):
        for x in v:
            _walk(key, x, f)
    elif isinstance(v, dict):
        if isinstance(v.get("value"), (int, float)) and v.get("unit") in UNIT:
            f.pairs.add((float(v["value"]), UNIT[v["unit"]]))
        for k, x in v.items():
            _walk(k, x, f)


def collect(evidence: list[Evidence]) -> Facts:
    f = Facts()
    for e in evidence:
        if e.flagged_injection:
            continue  # 含疑似指令的資料不能拿來當佐證
        f.text += "\n" + e.text
        if not e.ok:
            continue
        if e.data is None:
            _scan_text(e.text, f)
            continue
        _walk("", e.data, f)
        d = e.data
        if e.tool in ("assess_risk", "approve_site_difference") and d.get("zones"):
            f.lights[d.get("household_id")] = {z["zone"]: z["light_name"] for z in d.get("zones", [])}
        if e.tool == "approve_site_difference":
            f.prev_lights.update((x["zone"], x["before"]) for x in d.get("light_changes", []))
        if e.tool in ("record_measurement", "report_site_difference") or d.get("status") == "已核准":
            f.states.add("measured")
        if e.tool == "book_maintenance":
            f.states.add("booked")
        if e.tool == "submit_to_advisor" or d.get("status") in ("待長輩本人確認", "待派工", "已派工", "關懷中"):
            f.states.add("submitted")
        if (e.tool == "assign_work_package") or d.get("status") == "已派工":
            f.states.add("assigned")
        if e.tool == "notify_family" or any(ev.get("family_notified") for ev in d.get("events", []) or []):
            f.states.add("notified")
        c = d.get("elder_consent")
        if e.tool == "record_elder_consent" and d.get("decision") == "同意" or (isinstance(c, dict) and c.get("decision") == "同意"):
            f.states.add("consented")
    return f


def check_answer(answer: str, evidence: list[Evidence], entities: list[str], self_names: set[str]) -> list[str]:
    """回傳問題清單；空清單代表通過。"""
    f = collect(evidence)
    issues: list[str] = []
    body = LIST_MARK.sub(r"\1", answer)

    for m in TIME.finditer(body):
        if (int(m.group(1)), int(m.group(2))) not in f.times:
            issues.append(f"時間「{m.group(0)}」在工具結果中找不到")
    body_nt = TIME.sub(" ", body)
    for m in DATE_ISO.finditer(body_nt):
        if (int(m.group(2)), int(m.group(3))) not in f.dates:
            issues.append(f"日期「{m.group(0)}」在工具結果中找不到")
    body_nd = DATE_ISO.sub(" ", body_nt)
    for m in DATE_MD.finditer(body_nd):
        if (int(m.group(1)), int(m.group(2))) not in f.dates:
            issues.append(f"日期「{m.group(0)}」在工具結果中找不到")
    body_nd = DATE_MD.sub(" ", body_nd)
    for m in NUM_UNIT.finditer(body_nd):
        v = _n(m.group(2))
        unit = "元" if m.group(1) else UNIT.get(m.group(3) or "")
        if unit in STRICT_UNITS:
            if (v, unit) not in f.pairs:
                issues.append(f"「{m.group(0).strip()}」（數字與單位）在工具結果中找不到")
        elif v not in f.nums:
            issues.append(f"數字「{m.group(2)}」在工具結果中找不到")

    for z in ZONES:
        for m in re.finditer(z + r"(?!門)[^，。；：\n]{0,6}?(紅燈|黃燈|綠燈)", answer):
            if z == "浴室" and answer[m.start():m.start() + 3] == "浴室門":
                continue
            if (z, m.group(1)) in f.prev_lights and re.search(r"(由|從|原本|原來)", m.group(0)):
                continue
            truth = [lights.get(z) for lights in f.lights.values() if z in lights]
            if not truth:
                issues.append(f"「{z}{m.group(1)}」沒有 assess_risk 的結果可以佐證")
            elif m.group(1) not in truth:
                issues.append(f"「{z}」工具判斷是{truth[0]}，回答寫成{m.group(1)}")

    for name in sorted(set(entities), key=len, reverse=True):
        if name and name in answer and name not in f.text and name not in self_names:
            issues.append(f"提到「{name}」，但這次查詢的結果裡沒有這個人或家庭")

    for rx, need in CLAIMS:
        for m in rx.finditer(answer):
            before = answer[max(0, m.start() - 3):m.start()]
            if re.search(r"(尚未|還沒|沒有|未|不)$", before):
                continue
            if need not in f.states:
                issues.append(f"回答說「{m.group(0)}」，但工具結果沒有顯示這個動作已完成")
    if re.search(r"09\d{2}-?\d{3}-?\d{3}", answer) and not re.search(r"09\d{2}-?\d{3}-?\d{3}", f.text):
        issues.append("回答出現電話號碼，但工具結果中沒有")
    return list(dict.fromkeys(issues))


def compact(evidence: list[Evidence], limit: int = 2500) -> str:
    """給驗證 Agent 看的精簡證據。"""
    parts = []
    for e in evidence:
        t = e.text if len(e.text) <= limit else e.text[:limit] + "…（已截斷）"
        parts.append(f"[{e.id}] {e.tool} {json.dumps(e.args, ensure_ascii=False)} → {'成功' if e.ok else '失敗'}\n{t}")
    return "\n\n".join(parts) or "（這次沒有任何工具結果）"
