"""MCP Server 2｜store-erp：改善方案、庫存與報價（對應全國電子 ERP／進銷存）。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Literal

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcp.server import MCPServer  # noqa: E402
from mcp.server.mcpserver.exceptions import ToolError  # noqa: E402

from servers import rules, scenes  # noqa: E402
from servers.common import Ctx, audit, db, ok  # noqa: E402

NAME = "store-erp"
mcp = MCPServer(NAME, instructions="揪居家改善方案與報價：三層改善選項、門市庫存、整合報價。所有金額由這裡計算，AI 不可自行加總。")
CTX = Ctx()
ZONE_PARTS = {"走道": ["走廊牆面"], "浴室": ["浴室地板"], "浴室門": []}
SKU_RE = re.compile(r"^(SKU|KIT)-[A-Z0-9]{2,8}$")


def _assessment(c, household_id: str):
    row = c.execute("SELECT * FROM assessments WHERE household_id=? ORDER BY measured_on DESC, id DESC",
                    (household_id,)).fetchone()
    if not row:
        raise ToolError("這個家庭還沒有評估紀錄，請先完成問卷與 AR 掃描。")
    return row


def _opt(r) -> dict:
    return {"id": r["id"], "zone": r["zone"], "tier": r["tier"], "name": r["name"], "price": r["price"],
            "duration": r["duration"], "by_team": r["by_team"], "precondition": r["precondition"],
            "acceptance": r["acceptance"]}


@mcp.tool()
def recommend_options(household_id: str, zone: Literal["走道", "浴室", "浴室門"]) -> str:
    """列出某一區的改善做法（免費調整／全國電子安裝／簡易施工／改造工程），附誰施工、前置條件、驗收方式，
    並依材質辨識給推薦的安裝方式。價格為示範資料；price 為 null 代表需到府估價。唯讀。"""
    with db() as c:
        h = CTX.household(c, household_id)
        a = _assessment(c, household_id)
        rows = c.execute("SELECT * FROM options WHERE zone=? ORDER BY price IS NULL, price", (zone,)).fetchall()
    valid, _ = rules.validate_measures(json.loads(a["measures"]))
    zones = {z["zone"]: z for z in rules.assess(json.loads(a["answers"]), valid)}
    light = zones.get("浴室" if zone == "浴室門" else zone)
    mats = [m for m in rules.check_materials(json.loads(a["materials"])) if m["part"] in ZONE_PARTS[zone]]
    opts = []
    for r in rows:
        o = _opt(r)
        o["price_twd"] = o.pop("price")
        o["recommended"] = bool(r["recommended"])
        o["ltc_subsidy_items"] = rules.subsidy_for(r["id"])
        if r["id"] == "D3" and h["tenure"] == "租屋":
            o["warning"] = "這戶是租屋，須先取得房東同意"
        opts.append(o)
    audit(NAME, "recommend_options", CTX, {"household_id": household_id, "zone": zone}, "ok")
    return ok({
        "household_id": household_id, "zone": zone,
        "zone_light": None if zone == "浴室門" else {"light_name": light["light_name"], "reason": light["reason"]},
        "zone_note": "浴室門往內開，長輩若在浴室跌倒可能擋住門" if zone == "浴室門" else None,
        "options": opts,
        "install_method_by_material": mats,
        "price_note": "示範價格；需到府估價的項目不會先套用價格",
        "subsidy_note": "ltc_subsidy_items 是長照居家無障礙給付項目對照（團隊整理）；長照需要等級第 2 級以上才適用，"
                        "是否補助由照管專員評估",
        "store_products_hint": "全國電子官網實際販售的對應商品，可用 find_store_products 查詢" if zone != "浴室門" else None,
    })


@mcp.tool()
def check_stock(sku: str, store_id: Literal["fj", "gy", "bt"]) -> str:
    """查門市庫存。sku 例如 SKU-NL01（感應夜燈）、SKU-RP01（斜坡墊＋止滑地墊）、KIT-NIGHT（揪夜安照明組）。唯讀。"""
    if not SKU_RE.match(sku):
        raise ToolError("sku 格式不正確，例如 SKU-NL01。")
    with db() as c:
        store = c.execute("SELECT name FROM stores WHERE id=?", (store_id,)).fetchone()["name"]
        r = c.execute("SELECT name, qty FROM stock WHERE sku=? AND store_id=?", (sku, store_id)).fetchone()
    audit(NAME, "check_stock", CTX, {"sku": sku, "store_id": store_id}, "ok")
    if not r:
        return ok({"sku": sku, "store": store, "qty": 0, "note": "這家門市沒有這項商品的庫存紀錄"})
    return ok({"sku": sku, "store": store, "name": r["name"], "qty": r["qty"]})


@mcp.tool()
def estimate_quote(household_id: str, option_ids: list[str],
                   care_plan: Literal["揪夜安", "不加購"] = "揪夜安") -> str:
    """試算整合報價（單位：新台幣元）。同一區可以選多種做法（與原型顧問端相同），每個做法列一次，
    例如走道感應夜燈加止滑卡扣地板、浴室斜坡墊：["H1","H2","B1"]。
    揪夜安會依門檻高度自動決定是否加門檻提示燈條。只試算、不送出。唯讀。"""
    if not isinstance(option_ids, list) or not all(isinstance(x, str) for x in option_ids):
        raise ToolError("option_ids 必須是文字清單，例如 [\"H1\",\"B1\"]。")
    if len(set(option_ids)) != len(option_ids):
        raise ToolError("option_ids 有重複的項目，請每個做法只列一次。")
    with db() as c:
        CTX.household(c, household_id)
        a = _assessment(c, household_id)
        rows = {r["id"]: r for r in c.execute(
            f"SELECT * FROM options WHERE id IN ({','.join('?' * len(option_ids))})", option_ids)} if option_ids else {}
    unknown = [x for x in option_ids if x not in rows]
    if unknown:
        raise ToolError(f"找不到這些改善做法：{'、'.join(unknown)}。請先用 recommend_options 查詢可選的 id。")
    valid, invalid = rules.validate_measures(json.loads(a["measures"]))
    with db() as c:
        meta = {r["field"]: {"source": r["source"], "confidence_pct": r["confidence_pct"]}
                for r in c.execute("SELECT * FROM measure_meta WHERE assessment_id=?", (a["id"],))}
    valid, low, _ = rules.apply_sources(valid, meta)
    invalid = invalid + low
    kit = rules.care_kit_items(valid) if care_plan == "揪夜安" else None
    q = rules.quote([_opt(rows[x]) for x in option_ids], kit)
    if care_plan == "揪夜安" and any(b["field"] == "threshold_cm" for b in invalid):
        q["warning"] = "門檻量測值異常，是否需要門檻提示燈條要等重新量測後確認"
    audit(NAME, "estimate_quote", CTX, {"household_id": household_id, "option_ids": option_ids,
                                         "care_plan": care_plan}, "ok")
    return ok({"household_id": household_id, "currency": "TWD", **q})


PRODUCT_CATEGORIES = ("夜間照明", "感測與連網", "浴室防滑", "影像確認（選配）", "安裝與施工服務", "保養與保固")


@mcp.tool()
def find_store_products(category: Literal["夜間照明", "感測與連網", "浴室防滑", "影像確認（選配）", "安裝與施工服務",
                                         "保養與保固", "全部"] = "全部") -> str:
    """查全國電子官網實際販售、符合揪夜安的商品與服務（真實資料，非模擬），依類別列出貨號、品牌、適用方式、官網售價與查詢日期；
    也列出揪夜安需要、但官網查不到的品項（缺口）。售價只供參考，以門市為準；揪夜安報價仍用 estimate_quote。
    其他四個加購場域尚未開放，不在這裡。唯讀。"""
    cats = PRODUCT_CATEGORIES if category == "全部" else (category,)
    with db() as c:
        qd = c.execute("SELECT v FROM meta WHERE k='store_query_date'").fetchone()[0]
        prods = [dict(r) for r in c.execute(
            f"SELECT * FROM store_products WHERE category IN ({','.join('?' * len(cats))}) ORDER BY category, price IS NULL, price",
            cats)]
        gaps = [dict(r) for r in c.execute(
            f"SELECT * FROM kit_gaps WHERE category IN ({','.join('?' * len(cats))})", cats)]
    audit(NAME, "find_store_products", CTX, {"category": category}, "ok")
    return ok({
        "data_label": f"全國電子官網實際商品（{qd} 查詢），不是模擬資料；售價會變動，以門市為準",
        "category": category, "query_date": qd,
        "products": [{"sku": p["sku"], "name": p["name"], "brand": p["brand"], "category": p["category"],
                      "for_kit_item": p["kit_item"], "fit": p["fit"], "price_twd": p["price"],
                      "price_note": p["price_note"], "status": p["status"], "url": p["url"]} for p in prods],
        "not_found_on_site": [{"item": g["item"], "category": g["category"], "used_in": g["used_in"], "note": g["note"]}
                              for g in gaps],
        "next_step": "官網查不到的品項，請在參訪時確認門市是否販售，或由供應商引進、列入揪心願",
    })


@mcp.tool()
def get_scene_plan(scene: Literal["揪夜安", "揪食光", "揪清爽", "揪團聚", "揪回家"]) -> str:
    """查某個場域方案的內容：範圍、關懷設備、月費、關懷規則。目前只開放揪夜安；其他四個加購場域要等全國電子內部資料，
    開放前只回「尚未開放」，不提供價格與規則，AI 不可自行推估。唯讀。"""
    audit(NAME, "get_scene_plan", CTX, {"scene": scene}, "ok")
    if scene not in scenes.ENABLED_SCENES:
        return ok({"scene": scene, "scope": scenes.SCENE_SCOPE[scene], "available": False,
                   "reason": f"這個場域的燈號、關懷規則與報價，要等{scenes.WAITING_FOR}後才開放",
                   "what_to_say": "目前只提供揪夜安；這個場域會在取得全國電子資料後開放，價格與內容以屆時公告為準"})
    r = rules.CARE_RULES
    return ok({
        "scene": scene, "scope": scenes.SCENE_SCOPE[scene], "available": True,
        "care_kit": [{"name": k["name"], "detail": k["detail"], "price_twd": k["price"],
                      "condition": "浴室門檻高於 0.5 cm 才加裝" if kid == "strip" else "必含"}
                     for kid, k in rules.CARE_KIT.items()],
        "setup_fee_twd": rules.SETUP_FEE, "monthly_fee_twd": rules.MONTHLY_FEE["揪夜安"],
        "annual_fee_twd": rules.MONTHLY_FEE["揪夜安"] * rules.ANNUAL_MONTHS,
        "care_rules": [
            f"浴室停留超過 {r['bath_stay_min']} 分鐘：先燈光語音詢問，{r['elder_no_response_min']} 分鐘沒回應撥家中電話，"
            "兩次都沒回應才通知家人",
            f"早上 {rules.MORNING_CHECK} 還沒有活動：先語音詢問，{r['elder_no_response_min']} 分鐘沒回應撥家中電話，"
            "兩次都沒回應才通知家人",
            f"感測器 {r['sensor_offline_min']} 分鐘沒有回傳：視為設備問題，通知門市檢修並告知家人",
        ],
        "camera": "預設不裝鏡頭；長輩本人書面同意才加裝走廊攝影機，臥室與浴室不裝",
        "zones_assessed": ["臥室", "走道", "浴室", "浴室門"],
        "price_note": "示範價格（團隊推估），全國電子提供進貨價後修正",
    })


@mcp.resource("policy://pricing")
def pricing() -> str:
    """方案與計價方式（示範用）。"""
    return (
        "揪居家計價方式（示範用，非企業正式價格）\n"
        f"揪夜安｜單一場域關懷：夜間動線照明設備 {rules.CARE_KIT['night']['price']} 元、"
        f"門檻提示燈條 {rules.CARE_KIT['strip']['price']} 元（門檻高於 0.5 cm 才加裝）、設定費 {rules.SETUP_FEE} 元，一次付清；"
        f"關懷月費 {rules.MONTHLY_FEE['揪夜安']} 元（年繳為 {rules.ANNUAL_MONTHS} 個月月費）。\n"
        "改善項目依做法另計；改造工程需到府估價，估價前不套用價格。\n"
        "報價要長輩本人確認才算成交；兄弟姊妹可以分攤月費。"
    )


@mcp.prompt()
def family_explain(household_id: str) -> str:
    """給生活顧問：向家人說明報價的範本。"""
    return (f"請先用 estimate_quote 查 {household_id} 目前選的做法，再用家人聽得懂的話說明：每一項為什麼要做、誰來施工、"
            "一次付清多少、月費多少。最後提醒三件事：揪夜安預設不裝鏡頭、報價要長輩本人確認才算成交、"
            "月費兄弟姊妹可以分攤。所有數字照工具結果，不要自己加總。")


if __name__ == "__main__":
    mcp.run(transport="stdio")
