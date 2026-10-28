# 創新思考與設計

團隊「五子登科」的課程提案、「設計思考流程與十大工具」與可操作原型。

## 全國電子．揪居家（2026 InnoConnect+）

| 項目 | 連結 |
|---|---|
| Demo 影片 | `/demo`（`demo.html`）：v12，3:41，含字幕（SRT 可下載） |
| 設計思考流程與十大工具 | `/dt`（`jiujujia/design-thinking/`） |
| 揪居家 App（手機） | `/app`（`jiujujia/app.html`）：家庭、生活顧問、技師同一個登入頁，依帳號身分分流；手機掃碼開啟後可「加入主畫面」 |
| 企業管理端（電腦版） | `/admin`（`jiujujia/admin.html`）：總部與門市主管；生活顧問在門市電腦用 `/consultant`（`jiujujia/consultant.html`） |
| 舊網址 | `/consumer`、`/technician` 導向揪居家 App；`/consultant` 仍為生活顧問電腦版 |

一個揪居家 App（手機）＋企業管理端（電腦版），資料即時串接（`jiujujia/backend.js`，瀏覽器內模擬後端）。
生活顧問分工：手機版用在到店與到府（問診、同意事項、把手機轉給長輩大字確認），只產出方案草稿；電腦版整合正式報價（有版本號）、排工作包、核准差異，長輩同意的是正式版本。

### 原型說明
- 資料存在這台瀏覽器，可按右側「導覽」→「重設資料」回到示範狀態；不是正式雲端多人協作。
- AR 掃描原始影像只為分析暫存、分析完即清除；成果可存入「長輩家」、「我家」或這次先不儲存，存入的成果保存六個月。原型未接正式後端，自動清理與到期覆蓋標示為待實作。
- 價格、工期、協力工班與百分比為示範資料。

## 檔案結構

```
Innovation-Design/
├── index.html                首頁：四個入口（Demo 影片、設計思考、App、企業管理端）
├── demo.html                 /demo：Demo 影片頁（播放 demo/ 內的影片與字幕）
├── dt.html                   /dt：轉址到 jiujujia/design-thinking/
├── app.html                  /app：轉址到 jiujujia/app.html（揪居家 App，手機）
├── admin.html                /admin：轉址到 jiujujia/admin.html（企業管理端，電腦版）
├── consultant.html           /consultant：轉址到 jiujujia/consultant.html（生活顧問電腦版）
├── consumer.html             舊網址，轉址到揪居家 App
├── technician.html           舊網址，轉址到揪居家 App
├── .nojekyll                 讓 GitHub Pages 原樣發布（不經 Jekyll）
├── demo/
│   ├── index.html            /demo/ 轉址回 demo.html
│   ├── jiujujia_demo_v12.mp4 Demo 影片 v12（3:41）
│   ├── jiujujia_demo_v12.srt 字幕
│   └── poster.jpg            影片封面
├── jiujujia/                 原型本體
│   ├── app.html              揪居家 App（家庭、生活顧問、技師同一個登入頁，依身分分流）
│   ├── v5.js                 App 擴充：看結果、選改善方式與安裝方式、交給生活顧問
│   ├── admin.html            企業管理端（總部與門市主管：預約與派工、AI 推薦人力、服務地圖、校園大使）
│   ├── consultant.html       生活顧問電腦版（案件、整合報價、工作包與排程）
│   ├── backend.js            瀏覽器內模擬後端（資料存在 localStorage）
│   ├── guide.js              31 步導覽
│   ├── manifest.webmanifest、icon-192.png、icon-512.png   加入主畫面用
│   ├── ar/                   AR 掃描（場勘）示意圖
│   ├── home/                 App 首頁仿全國電子 App 的畫面素材
│   ├── map/                  服務地圖（geo.js 行政區、stores.js 門市、servicemap.js 繪製）
│   ├── vendor/               three.js（3D 居家模型）與授權
│   └── design-thinking/      揪居家設計思考流程與十大工具（index.html、10 頁 JPG、PDF）
├── e2e/                      Playwright 端到端測試（見 e2e/README.md）
└── .github/workflows/e2e.yml 推送到 main 時自動跑 e2e 測試
```

網址都用根目錄的轉址頁（例如 `/app`、`/admin`），提案書的 QR Code 也指向這些短網址；搬動 `jiujujia/` 內的檔案時，要一起改轉址頁，QR Code 才不會失效。

## 端到端測試

`e2e/` 資料夾是 Playwright 端到端測試，涵蓋 App 與企業管理端入口、登入分流、31 步導覽與資料串接。執行方式見 [e2e/README.md](e2e/README.md)。
