# AI顧問阿國（jiujujia-agent）

AI顧問阿國（簡稱阿國）是揪居家唯一的 AI：**一個核心、一套 API**，同時給二階提案新版原型 `/v2/`、軟工課 MVP（`jiujujia-app/`）與 AI 語言模型系統整合課使用。規格見 `jiujujia-app/ARCHITECTURE.md` 第 7 章（`docs/aguo-plan` 分支），本資料夾對應 issue #14。

以二階 AI 實作 v1.3 為基底（含 v1.0～v1.2 全部內容）：三個 MCP Server、三道檢查（程式檢查 → 驗證 Agent → 退回重寫 → 規則備援）、揪夜安完整規則、量測頁與家電檔案。
**家庭、案件、人員都是模擬資料**；全國電子商品與服務是 2026-10-31 在官網查到的真實資料（售價以門市為準）。

## 結構

```
jiujujia-agent/
├─ aguo/
│  ├─ api.py              HTTP API：POST /v1/<capability>、GET /v1/health、GET /v1/capabilities
│  ├─ pipeline.py         共用檢查管線：嚴格輸入驗證 → 規則計算 → LLM 說明 → 程式檢查 → 驗證 Agent → 重寫一次 → 規則備援
│  ├─ capabilities/       7 項能力；#14 完成 assess，其他已登記（呼叫回 501，內容在 #15～#20）
│  ├─ llm.py              唯一的 LLM 介面（其他地方不准直接呼叫 LLM；送出前遮蔽電話與 Email）
│  ├─ agent.py            對話模式（v1.3 Host：連三個 MCP Server、工具呼叫迴圈）
│  ├─ checks/             guard 守門、evidence 證據比對、verifier 驗證 Agent、fallback 規則備援
│  └─ __main__.py         命令列（python -m aguo …）
├─ servers/               MCP Server：home_assess（評估）、store_erp（方案與報價）、service_crm（案件、派工、關懷、家電檔案）；rules.py、scenes.py
├─ knowledge/             risk-rules.json（燈號與量測規則）、fix-options.json（改善做法）、catalog/（全國電子商品）
├─ evals/                 assess_cases.json（示範與測試案例）、questions.json＋run_eval.py（真實 LLM 評測 30 題）
├─ tests/                 pytest（全部用模擬 LLM）
├─ ar-web/                量測頁（卡片近拍、A4 紙照片、AR 掃描、捲尺；照片算完即清除）
├─ docs/                  能力表、架構圖、缺陷紀錄、Demo 腳本、二階功能完備檢查表
├─ make_data.py           產生模擬資料（data/demo.db；測試資料 tests/test.db 含陷阱）
└─ .env.example           金鑰範本（真的金鑰只放 .env，不 commit）
```

## 安裝（在 jiujujia-agent/ 執行）

Windows：
```
py -V:3.13 -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements-dev.txt
python make_data.py
python make_data.py --dataset test
```
macOS／Linux 把前兩行換成 `python3.13 -m venv .venv` 和 `source .venv/bin/activate`。
成功的樣子：最後兩行出現 `[OK] 已產生 demo 資料…`、`[OK] 已產生 test 資料…`。

## 測試（不用金鑰）
```
pytest
```
成功的樣子：`85 passed, 1 skipped`（被略過的是量測頁端到端測試，要裝 Playwright 與 Pillow；裝了就是 `86 passed`）。
內容：對話模式 48 題（二階 v1.0～v1.3 的 46 題＋工具參數嚴格型別 2 題）、API 與檢查管線、規則資料檔、單一核心、量測幾何、材質檢查。

## CLI 示範指令

不用金鑰（沒有 `.env` 時自動用規則結果，回應標示 `fallback: true`）：
```
python -m aguo capabilities
python -m aguo ask assess evals/assess_cases.json --case lin
python -m aguo ask assess evals/assess_cases.json --case huang
python -m aguo ask assess evals/assess_cases.json --case injection_note
python -m aguo export --demo
python -m aguo schemas
python -m aguo serve --port 8710
```
- `ask`：林媽媽家走道紅燈、浴室黃燈；黃先生家門檻剛好 3 cm，標成需技師到府確認；`injection_note` 的備註藏了指令，阿國只當資料。
- `export --demo`：產生二階 `/v2/` 的預先結果（接法 C）到 `exports/demo/`。
- `schemas`：輸出各能力的 JSON Schema 到 `aguo/schemas/`，給 `jiujujia-app/lib/shared/schemas/` 使用。
- `serve` 之後可以另開終端機：
  ```
  curl -s localhost:8710/v1/health
  curl -s -X POST localhost:8710/v1/assess -H "Content-Type: application/json" -d '{"answers":{"live":"剛開始一個人住","night":"一晚一次","light":"偏暗","phone":"會用 LINE","worry":"夜間跌倒沒人知道"},"measurements":{"corridor_cm":92,"threshold_cm":2}}'
  ```
  把 `92` 改成 `"76"` 會回 422（字串數字一律拒絕）。

要金鑰（先做下一節「設定金鑰」）：
```
python -m aguo chat --user chen --detail
python -m aguo chat --user wang --detail
python -m evals.run_eval --tester 凱
```
`--user`：`chen` 陳小姐（家人）、`wang` 王小明（生活顧問）、`chent` 陳技師、`li_f` 李小姐、`zhang` 張經理（總部）。`--detail` 顯示每道檢查與工具呼叫；要送出、派工、通知時會問 `[y/N]`。
對話範例（陳小姐）：「我媽家評估結果怎麼樣？」→「浴室要怎麼改比較好？」→「走道裝感應夜燈加止滑卡扣地板、浴室用斜坡墊加止滑地墊，再加揪夜安，總共要多少錢？」（10,000 元、月費 299 元）。
`run_eval` 跑 30 題真實 LLM 評測，輸出 `docs/verification_log_日期時間.csv`（AI Verification Log）。

## 設定金鑰
1. 把 `.env.example` 複製成 `.env`（只放在 `jiujujia-agent/`，已在 `.gitignore`，不要 commit、不要截圖）。
2. 填 Cloudflare 的 `CF_ACCOUNT_ID` 與 `LLM_API_KEY`（Workers AI 權限）。外流就到 Cloudflare 後台撤銷重發。
3. 預設模型：回答 Llama 3.3 70B、驗證 Mistral Small 3.1（不同家族，避免同樣的盲點）。

## API 回應格式（每項能力都一樣）
```json
{"capability": "assess", "label": "AI顧問阿國建議", "items": [...], "explanation": "...", "sources": [...],
 "fallback": false, "fallback_reason": null,
 "checks": {"program": true, "verifier": true, "retries": 0, "issues": []}, "model": "...", "input_flags": []}
```
錯誤：400 不是 JSON｜404 沒有這項能力｜422 輸入格式不對｜501 能力還沒實作（附 issue 編號）。

## 阿國的規則（ARCHITECTURE.md §7.4）
1. 阿國只提建議，不寫入報價、長輩同意或派工單。
2. 送給 LLM 的只有區域、問卷選項、尺寸、材質；不含姓名、地址、電話、Email、照片、AR 原始資料。`assess` 已做到；對話模式會把案件資料（含模擬的稱謂）交給 LLM，個資自動檢查在 #21。
3. 輸入輸出都用嚴格 Schema；字串 `"False"`、`"76"` 一律拒絕（API 與 MCP 工具參數都是）。
4. 每個回答都要過程式檢查與驗證 Agent；沒過重寫一次，還是沒過、逾時（10 秒，`plan_all` 30 秒）或沒有 LLM，就用規則結果並標 `fallback: true`。
5. 使用者自由文字只放在分隔欄位當資料，不當指示。
6. 金鑰只放 `.env`；測試與 CI 一律用模擬 LLM。
7. 新的 AI 功能只能加成 `aguo/capabilities/` 的一項能力；`tests/test_core.py` 會檢查 `aguo/llm.py` 以外沒有直接呼叫 LLM。

## 規則資料從哪裡來
燈號、量測、材質、關懷時間與二階規則（異常先問長輩兩次、每區可複選、補助轉介長照第 2 級以上）都在 `knowledge/risk-rules.json`，程式只讀資料不寫死。
`jiujujia-app/lib/shared/data/risk-rules.json`（#4）建好後，阿國會優先讀那一份；也可以用環境變數 `AGUO_RISK_RULES` 指定。
注意：#4 的暫定門檻（門檻超過 2 cm 紅燈、走道 80～90 cm 黃燈）和二階 v1.3（超過 3 cm 紅燈、80 cm）不同，要由 contract-architect 決定統一成哪一組，改數值時一起改測試。

## 量測頁
用瀏覽器開 `ar-web/measure.html` 就能試照片量測與捲尺輸入；AR 掃描要 Android Chrome＋https，尚未實機驗證。
`node ar-web/test_geometry.js` 驗證量測幾何（19 題）；`python ar-web/test_page.py` 用合成照片走完整流程（需 Playwright 與 Pillow）。
