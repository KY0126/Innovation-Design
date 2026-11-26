# 揪居家｜進度檔（STATUS）

> 唯一的進度檔（CLAUDE.md W5）。每完成一件就更新；新視窗開工先讀這份（W6）。
> 最後更新：2026/11/26 10:30

## 目前版本

| 項目 | 版本／位置 |
|---|---|
| 原型（Demo 版） | main（GitHub Pages `/app`、`/admin`），含 PR #43 圖 6 ② 3D 邊界修正 |
| 決選構想計畫書 | 決選 v2（11/26 約 07:25，docx＋pdf＋md） |
| 交接 zip | 最終版 v3（原型快照為 main 204e02f） |
| LINE 官方帳號 | 五子登科：歡迎訊息、12 則自動回覆、頭貼、分頁圖文選單（richmenuswitch）已上線 |
| 示意總表畫布 | 「揪居家｜示意總表」 https://claude.ai/artifact/9AMwfpvtMjKaUytfGsLjSj （S00 目錄與規則；下一個題目從 S01 開始） |

## 待使用者確認

| 項目 | 你要做的事 |
|---|---|
| PR #46（Agent、skill、PRD、W1–W7、STATUS） | 說「合併」 |
| 用語規範列出的 15 處禁用詞（基準線 9 組） | 決定要不要修 |
| LINE 分頁選單與 12 個拼圖按鈕 | 用手機實測 |
| 17 個 issue、標籤、里程碑（`docs/prd/issues.md`） | 同意後才建立（目前都還沒建） |

## 待更新進 zip（說「更新」時照這張清單做）

- 原型快照換成 PR #43 之後的 main（圖 6 ② 3D 邊界修正）。
- 新增專案規範：`CLAUDE.md`、`docs/context/` 七份、`docs/STATUS.md`。
- 新增測試基礎：`tests/`、e2e 新 projects、CI `checks`。
- 新增 `.claude/agents/`、`.claude/skills/`、`docs/prd/`、`.github/` 範本（PR #46 合併後）。

## 進行中

| 任務 | 步驟 | 狀態 | 時間 |
|---|---|---|---|
| 寫入工作流程 W1–W7 | 1 CLAUDE.md ✅／2 STATUS ✅／3 示意總表畫布 ✅／4 更正 PR #46 說明 ✅／5 等「合併」▶ | 進行中 | 11/26 10:20 |

## 之後要做

| 時間 | 項目 |
|---|---|
| 12/11 起（已排提醒） | Demo／實用版拆分（`/live/app`、`/live/admin` 接 Supabase）；LINE 第二批 |
| 12/14 | 實用版 MVP 里程碑 |
| 12/16 | 決選交件 |
