"""能力 talk_script：說明話術：推薦理由、對長輩的說法。

已登記在 AI顧問阿國的能力清單，內容由 issue #17 實作；在那之前呼叫 POST /v1/talk_script 會回 501，不會假裝有結果。
"""
from __future__ import annotations

from aguo.capabilities.base import NotImplementedCapability


class TalkScript(NotImplementedCapability):
    name = "talk_script"
    title = "說明話術：推薦理由、對長輩的說法"
    issue = 17
    budget_s = 10.0
