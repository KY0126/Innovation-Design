"""AI顧問阿國的能力清單（ARCHITECTURE.md §7.1）。每項能力一個端點：POST /v1/<capability>。

#14 完成核心與 assess（v1.3 規則已就緒）；其他能力已登記，內容在各自的 issue 實作，呼叫時回 501。
新的 AI 功能一律在這裡加一項能力，不另寫程式或服務（§7.4 第 8 條）。
"""
from __future__ import annotations

from aguo.capabilities.assess import Assess
from aguo.capabilities.base import Capability
from aguo.capabilities.crew_recommend import CrewRecommend
from aguo.capabilities.knowledge_qa import KnowledgeQA
from aguo.capabilities.plan_all import PlanAll
from aguo.capabilities.quote_draft import QuoteDraft
from aguo.capabilities.talk_script import TalkScript
from aguo.capabilities.wish_classify import WishClassify

REGISTRY: dict[str, Capability] = {c.name: c() for c in [
    Assess, QuoteDraft, TalkScript, CrewRecommend, WishClassify, KnowledgeQA, PlanAll]}
