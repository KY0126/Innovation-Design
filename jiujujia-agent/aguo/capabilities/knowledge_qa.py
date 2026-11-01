"""能力 knowledge_qa：知識問答（長照 1966、輔具、居家安全），附來源。

已登記在 AI顧問阿國的能力清單，內容由 issue #15 實作；在那之前呼叫 POST /v1/knowledge_qa 會回 501，不會假裝有結果。
"""
from __future__ import annotations

from aguo.capabilities.base import NotImplementedCapability


class KnowledgeQA(NotImplementedCapability):
    name = "knowledge_qa"
    title = "知識問答（長照 1966、輔具、居家安全），附來源"
    issue = 15
    budget_s = 10.0
