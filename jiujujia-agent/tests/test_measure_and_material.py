"""量測頁（ar-web/）與材質檢查。量測幾何用 Node 跑（沒有 Node 就略過）；量測頁端到端要 Playwright（沒有就略過）。

材質辨識：§7.4 第 2 條規定照片不送 LLM，所以 v1.3 的雲端視覺模型第二意見不放進 repo；
材質只用手機上的分類器＋家人確認，程式檢查在 servers/rules.check_materials。
"""
from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from servers import rules  # noqa: E402


@pytest.mark.skipif(shutil.which("node") is None, reason="沒有安裝 Node.js")
def test_measure_geometry_with_node():
    r = subprocess.run(["node", str(ROOT / "ar-web" / "test_geometry.js")], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    assert "量測幾何測試：19/19 通過" in r.stdout


@pytest.mark.skipif(importlib.util.find_spec("playwright") is None or importlib.util.find_spec("PIL") is None
                    or shutil.which("node") is None, reason="沒有 Playwright／Pillow／Node")
def test_measure_page_end_to_end():
    r = subprocess.run([sys.executable, str(ROOT / "ar-web" / "test_page.py")], capture_output=True, text=True)
    if "Executable doesn't exist" in r.stdout + r.stderr:
        pytest.skip("Playwright 瀏覽器沒有安裝")
    assert r.returncode == 0, r.stdout + r.stderr


def _m(**kw):
    base = {"part": "浴室地板", "material": "磁磚", "ai_confidence_pct": 93, "family_confirmed": True,
            "install_note": "止滑條貼在門檻內側"}
    return rules.check_materials([{**base, **kw}])[0]


def test_material_confirmed_and_confident_is_used():
    m = _m()
    assert m["check"] == "可帶入" and m["install_note"] == "止滑條貼在門檻內側"


@pytest.mark.parametrize("kw, word", [
    ({"family_confirmed": False}, "家人還沒確認"),
    ({"ai_confidence_pct": 72}, "72%"),
    ({"second_check": "塑膠地板"}, "不一致"),
    ({"material": "大理石"}, "不在"),
])
def test_material_problems_fall_back_to_safe_install(kw, word):
    m = _m(**kw)
    assert word in m["check"] and m["install_note"] == rules.SAFE_INSTALL, m
