"""能力 quote_draft：報價草稿（品項來自 quote-items.json，整數新台幣）。

已登記在 AI顧問阿國的能力清單，內容由 issue #17 實作；在那之前呼叫 POST /v1/quote_draft 會回 501，不會假裝有結果。
"""
from __future__ import annotations

from aguo.capabilities.base import NotImplementedCapability


class QuoteDraft(NotImplementedCapability):
    name = "quote_draft"
    title = "報價草稿（品項來自 quote-items.json，整數新台幣）"
    issue = 17
    budget_s = 10.0
