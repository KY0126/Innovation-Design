"""能力 plan_all：一鍵整理：評估 → 報價草稿 → 派工推薦（多代理人協調）。

已登記在 AI顧問阿國的能力清單，內容由 issue #20 實作；在那之前呼叫 POST /v1/plan_all 會回 501，不會假裝有結果。
"""
from __future__ import annotations

from aguo.capabilities.base import NotImplementedCapability


class PlanAll(NotImplementedCapability):
    name = "plan_all"
    title = "一鍵整理：評估 → 報價草稿 → 派工推薦（多代理人協調）"
    issue = 20
    budget_s = 30.0
