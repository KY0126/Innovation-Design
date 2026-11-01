# [AI顧問阿國] 核心進 repo：統一 API、檢查管線、共用規則檔

## User Story
身為 **開發團隊**，
我想要 **把二階 v1.3 的阿國放進 `jiujujia-agent/`，整理成一套 API 和一條共用的檢查管線**，
以便 **二階 `/v2/`、軟工 MVP、AI 課都呼叫同一個阿國，不各做各的**。

## 領域
- [ ] customer　- [ ] store　- [x] 阿國（ARCHITECTURE.md §7）

## 驗收條件（Given-When-Then）
**正常情境**
- Given v1.3 的程式，When 搬進 `jiujujia-agent/`，Then 結構符合 ARCHITECTURE.md §7.3，v1.3 原有功能與測試照常通過。
- Given 任一項能力，When 呼叫 `POST /v1/<capability>`，Then 一律經過「輸入驗證 → 程式檢查 → 驗證 Agent → 退回重做 → 規則備援」，回應附 `checks` 與 `fallback`。
- Given `lib/shared/data/risk-rules.json`，When 規則 MCP server 計算燈號，Then 與網站 #4 的結果完全一致（同一組測試資料）。
- Given `jiujujia-agent/` 有變動，When 開 PR，Then GitHub Actions 自動跑 pytest（使用模擬 LLM）。

**輸入邊界**
- Given 參數傳入字串 `"False"`、`"76"`，When 呼叫任何工具，Then 拒絕並回傳型別錯誤。

**例外與錯誤處理**
- Given 沒有 `.env` 或 LLM 無法連線，When 呼叫，Then 回傳規則備援結果（`fallback: true`），服務不中斷。
- Given 有人在 `aguo/` 以外直接呼叫 LLM，When code review，Then 退回（ARCHITECTURE.md §7.4 第 8 條）。

## 使用方
- [ ] 二階 `/v2/`：提供 `python -m aguo export --demo` 產生預先結果的指令
- [ ] 軟工 MVP：API 規格寫進 `lib/shared/schemas/`
- [ ] AI 課：CLI 示範指令寫進 `jiujujia-agent/README.md`

## 不在本 issue 範圍
- 各項能力的內容（#15～#21）。

## 相依
- 需要：v1.3 程式（由「二階提案｜LLM」推到 `feat/14-aguo-core` 分支的 `jiujujia-agent/`）、#4 的共用規則檔
