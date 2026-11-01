"""能力 wish_classify：揪心願分類建議。

已登記在 AI顧問阿國的能力清單，內容由 issue #19 實作；在那之前呼叫 POST /v1/wish_classify 會回 501，不會假裝有結果。
"""
from __future__ import annotations

from aguo.capabilities.base import NotImplementedCapability


class WishClassify(NotImplementedCapability):
    name = "wish_classify"
    title = "揪心願分類建議"
    issue = 19
    budget_s = 10.0
