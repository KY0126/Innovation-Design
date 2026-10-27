# 揪居家原型｜端到端測試（Playwright）

用 Playwright 測原型（一個揪居家 App＋企業管理端）：入口、登入分流、31 步導覽（含生活顧問手機版）、資料串接與版面。電腦版（1440）與手機版（390）各跑一輪。

## 怎麼跑

```
cd e2e
npm install
npx playwright install chromium
npm test
```

- 測試會自動用 `python3 -m http.server` 在 8766 埠開本機伺服器，根目錄預設是上一層（專案根目錄），可用環境變數 `REPO` 指定。
- 跑完用 `npm run report` 打開 HTML 報告。
- 只跑一個檔：`npx playwright test tests/guide.spec.js --project desktop`

## 自動執行

每次推送到 `main` 或開 PR，GitHub Actions（`.github/workflows/e2e.yml`）會自動跑全部測試；結果在 GitHub 的 Actions 分頁，報告可在該次執行的「e2e-report」下載。也可以在 Actions 分頁手動按「Run workflow」。

## 測什麼

| 檔案 | 內容 |
|---|---|
| tests/entry.spec.js | 四個入口各自落在自己的登入頁；首頁所有連結都打得開 |
| tests/auth.spec.js | 揪居家 App 依身分分流（家庭／生活顧問／技師），總部帳號被擋下；企業管理端兩個入口（總部、生活顧問門市電腦），家庭與技師被擋下；生活顧問分工：手機只提醒待審差異、長輩大字確認顯示電腦版正式版本 |
| tests/guide.spec.js | 導覽 31 步跨 App 與企業管理端走完：每步編號框都找得到、無錯誤、無對話框；並驗證資料串接（家庭送出 → 生活顧問待整合報價；技師回報差異 → 待審差異 +1；長輩驗收 → 工單已完成、關懷中家庭 +1；一鍵預約 → 企業管理端新維護工單） |
| tests/follow.spec.js | 導覽跟著畫面走：自己點也算完成並自動下一步；走到某一步專屬畫面時卡片跟上；走到導覽沒介紹的畫面時提示（可帶回或收合）；按返回不自動倒退 |
| tests/layout.spec.js | 電腦版標準手機框比例與導覽面板位置；手機寬度各登入頁與首頁皆無左右溢出；手機導覽抽屜不蓋住編號框 |

## 改原型後要注意
- 導覽步數會自動從 `jiujujia/guide.js` 讀取，增減步驟不必改測試。
- 示範資料（`jiujujia/backend.js`）的帳號，或林女士家到府安裝工單（`W-年月日-06`）改了，資料串接的檢查也要跟著改。
