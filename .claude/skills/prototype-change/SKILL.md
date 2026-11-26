---
name: prototype-change
description: 揪居家原型修改流程（文字說明、畫布示意、確認、分支、測試、PR、等合併）。要改 /app、/admin 或 jiujujia/*.js 時使用。
---

# 原型修改

1. **文字說明**：要改哪裡、為什麼、會影響哪些畫面與測試。
2. **示意**：交給 visual-mockup，在 Design 畫布放改之前／改之後；等使用者回「照這樣改」。
3. **分支**：`git checkout -b stage2-<主題>`（從最新 main）。
4. **實作**：
   - 改了被引用的 JS，加大引用處 `?v=`（例：`wish.js` 的 `cad3d.js?v=`、`app.html` 的 `wish.js?v=`）。
   - 改畫面文字同步改 `e2e/` 測試；新規則補 `tests/unit/` 或 `tests/integration/`。
   - 暫時檔用底線開頭，不提交。
5. **測試**：
   - `cd tests && npm run check`
   - repo 根目錄 `python3 -m http.server 8766`，再 `cd e2e && npm test`
   - 失敗依 test-fix skill。
6. **PR**：`gh api repos/KY0126/Innovation-Design/pulls -f title=… -f head=… -f base=main -F body=@檔案`（GraphQL 不可用）；照 PR 範本填。
7. **等「合併」**：等 GitHub Actions 兩段都綠燈再合併；合併 API 偶爾回 500，間隔 20 秒重試。
8. **合併後**：更新交接文件與最終版 zip 的原型快照（舊版封存）。
