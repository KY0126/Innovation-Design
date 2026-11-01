"""能力（capability）的共同介面：每項能力只負責「輸入格式」與「規則計算」，檢查與備援一律交給 aguo/pipeline.py。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import ClassVar

from pydantic import BaseModel, ConfigDict


class StrictInput(BaseModel):
    """所有能力的輸入都用嚴格型別：字串 "76"、"False" 不會被自動轉成數字或布林；多餘欄位一律拒絕。"""
    model_config = ConfigDict(strict=True, extra="forbid")


@dataclass
class Computed:
    """規則算出的結果。facts 是唯一會送給 LLM 的資料（不含姓名、地址、電話、照片、AR 原始資料）。"""
    items: list[dict]
    facts: dict
    fallback_text: str
    sources: list[dict] = field(default_factory=list)
    note: str | None = None          # 使用者自由文字（只當資料，放在分隔欄位裡）


class Capability:
    name: ClassVar[str]
    title: ClassVar[str]
    issue: ClassVar[int]
    implemented: ClassVar[bool] = True
    budget_s: ClassVar[float] = 10.0
    Input: ClassVar[type[StrictInput] | None] = None

    def compute(self, inp: StrictInput) -> Computed:  # pragma: no cover - 子類別實作
        raise NotImplementedError

    def prompt(self, comp: Computed) -> str:
        """請 LLM 寫說明的指示（不含資料本身；資料由 pipeline 放進分隔欄位）。"""
        return "請用繁體中文、3 到 5 句話向家人說明下面的結果。"

    def extra_checks(self, comp: Computed, text: str) -> list[str]:
        return []


class NotImplementedCapability(Capability):
    """已登記、但內容由後續 issue 實作的能力：呼叫時回 501，不會假裝有結果。"""
    implemented = False
