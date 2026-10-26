# 揪居家原型｜端到端測試（Playwright）

用 Playwright 測四端原型：入口、登入、30 步導覽、四端資料串接與版面。電腦版（1440）與手機版（390）各跑一輪。

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
| tests/auth.spec.js | 帳號放錯入口會被擋下並提示正確入口；四端一鍵示範登入；換端不沿用前一端登入 |
| tests/guide.spec.js | 導覽 30 步跨四端走完：每步編號框都找得到、無錯誤、無對話框；並驗證四端資料串接（家庭送出 → 生活顧問待整合報價；技師回報差異 → 待審差異 +1；長輩驗收 → 工單已完成、關懷中家庭 +1；一鍵預約 → 企業管理端新維護工單） |
| tests/layout.spec.js | 電腦版標準手機框比例與導覽面板位置；手機寬度四端皆無左右溢出；手機導覽抽屜不蓋住編號框 |

## 改原型後要注意
- 導覽步數會自動從 `jiujujia/guide.js` 讀取，增減步驟不必改測試。
- 示範資料（`jiujujia/backend.js`）的帳號、工單編號 `W-20261027-06` 改了，資料串接的檢查也要跟著改。
