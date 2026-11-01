"""能力 crew_recommend：派工推薦：全國電子技師／協力工班。

已登記在 AI顧問阿國的能力清單，內容由 issue #18 實作；在那之前呼叫 POST /v1/crew_recommend 會回 501，不會假裝有結果。
"""
from __future__ import annotations

from aguo.capabilities.base import NotImplementedCapability


class CrewRecommend(NotImplementedCapability):
    name = "crew_recommend"
    title = "派工推薦：全國電子技師／協力工班"
    issue = 18
    budget_s = 10.0
