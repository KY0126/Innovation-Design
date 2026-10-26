# 創新思考與設計

團隊「五子登科」的課程提案、「設計思考流程與九大工具」與可操作原型。

## 全國電子．揪居家（2026 InnoConnect+）

| 項目 | 連結 |
|---|---|
| Demo 影片 | https://youtu.be/BWO1hCpEwwU |
| 設計思考流程與九大工具 | `/dt`（`jiujujia/design-thinking/`） |
| 消費者端 | `/consumer`（以示範帳號登入 `jiujujia/app.html`） |
| 生活顧問端 | `/consultant`（`jiujujia/consultant.html`） |
| 技師端 | `/technician`（以技師示範帳號登入 `jiujujia/app.html`） |
| 企業管理端 | `/admin`（`jiujujia/admin.html`） |
| 舊網址 | `/app` 仍可使用，導向消費者、顧問、技師共用的 App |

四端共用同一套後端與核心資料模型（`jiujujia/backend.js`，瀏覽器內模擬後端）。

### 原型說明
- 資料存在這台瀏覽器，可按右側「導覽」→「重設資料」回到示範狀態；不是正式雲端多人協作。
- AR 掃描原始影像只為分析暫存、分析完即清除；成果可存入「長輩家」、「我家」或這次先不儲存，存入的成果保存六個月。原型未接正式後端，自動清理與到期覆蓋標示為待實作。
- 價格、工期、協力工班與百分比為示範資料。
