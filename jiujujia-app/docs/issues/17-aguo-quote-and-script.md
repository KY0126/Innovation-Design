# [AI顧問阿國] 報價草稿與說明話術

## User Story
身為 **生活顧問**，
我想要 **阿國依改善方案和量測尺寸擬出報價品項草稿，並附上推薦理由與對長輩的說法**，
以便 **我只要確認修改，就能整合報價並向長輩說明清楚**。

## 領域
- [ ] customer　- [x] store　- [x] 阿國（能力 `quote_draft`、`talk_script`）

## 驗收條件（Given-When-Then）
**正常情境**
- Given 一份已確認的改善方案，When 呼叫 `quote_draft`，Then 列出品項（名稱、單位、數量、單價取自 `quote-items.json`），金額為整數新台幣，小計與總額經程式驗算正確。
- Given 報價草稿，When 呼叫 `talk_script`，Then 產生推薦理由與一段給長輩的白話說明（大字、短句）。
- Given 草稿，When 顧問勾選並按「加入報價」，Then 才寫入報價（阿國不會直接建立或修改報價）。

**輸入邊界**
- Given 地板類品項，When 計算數量，Then 依坪數（小數一位）；門檻依公尺。

**例外與錯誤處理**
- Given 阿國回傳不在 `quote-items.json` 的品項或算錯金額，When 程式檢查，Then 剔除或退回重做。
- Given 話術出現誇大或保證用語（例如「一定不會跌倒」），When 驗證 Agent 檢查，Then 退回重寫。

## 使用方
- [ ] 二階 `/v2/`：生活顧問「調整方案」頁的 AI 建議組合、推薦理由、對長輩說法（接法 C）
- [ ] 軟工 MVP：報價頁「請阿國擬草稿」（12/17 起，接在 #7 後）
- [ ] AI 課：驗證 Agent 退回案例收進 AI Verification Log

## 相依
- 需要先完成：#14、#16
