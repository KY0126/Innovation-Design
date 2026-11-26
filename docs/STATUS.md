# 揪居家｜進度檔（STATUS）

> 唯一的進度檔（CLAUDE.md W5）。每完成一件就更新；新視窗開工先讀這份（W6）。
> 最後更新：2026/11/26 13:20

## 目前版本

| 項目 | 版本／位置 |
|---|---|
| 原型（Demo 版） | main（GitHub Pages `/app/`、`/admin/`），含 PR #43、#47（`/app/` 轉址修 LINE 404） |
| 原型（實用版） | 骨架已上線 `/live/app/`、`/live/admin/`（PR #48）；LINE 登入、長輩家、評估燈號、分享、後台報價、我很好、揪心願公開頁在分支 `stage2-live-db`（PR 待合併）；資料庫 jjj 區與 Edge Function `line-login`、`line-push` 已上線 |
| 實用版設計稿 | `docs/design/實用版_資料表權限與LINE循環.md`（v2，已確認） |
| 決選構想計畫書 | 決選 v2（11/26 約 07:25，docx＋pdf＋md） |
| 交接 zip | 最終版 v3（原型快照為 main 204e02f） |
| LINE 官方帳號 | 五子登科：歡迎訊息、12 則自動回覆、頭貼、分頁圖文選單（richmenuswitch）已上線 |
| 示意總表畫布 | 「揪居家｜示意總表」 https://claude.ai/artifact/9AMwfpvtMjKaUytfGsLjSj （S00 目錄與規則；下一個題目從 S01 開始） |

## 待使用者確認

| 項目 | 你要做的事 |
|---|---|
| 第 6 步（回家做，約 15 分鐘） | ① LINE Developers 五子登科 Provider 新增 LINE Login（名稱「五子登科｜揪居家」、台灣、Web app、綁定現有五子登科官方帳號、Callback `https://ky0126.github.io/Innovation-Design/live/app/`、先維持開發中），送出前再確認一次；② Supabase secrets 由 K.Y. 自己貼：`LINE_LOGIN_CHANNEL_ID`、`LINE_LOGIN_CHANNEL_SECRET`、`LINE_OA_CHANNEL_ID`、`LINE_OA_CHANNEL_SECRET`；③ Supabase 設定 › Data API › Exposed schemas 加入 `jjj`；④ `live-config.js` 填 Channel ID；⑤ 建 1 個生活顧問測試帳號；⑥ 手機實測 |
| 用語規範列出的 15 處禁用詞（基準線 9 組） | 決定要不要修 |
| LINE 分頁選單與 12 個拼圖按鈕 | 用手機實測 |
| 17 個 issue、標籤、里程碑（`docs/prd/issues.md`） | 同意後才建立（目前都還沒建） |

## 待更新進 zip（說「更新」時照這張清單做）

- 原型快照換成 PR #43 之後的 main（圖 6 ② 3D 邊界修正）。
- 新增專案規範：`CLAUDE.md`、`docs/context/` 七份、`docs/STATUS.md`。
- 新增測試基礎：`tests/`、e2e 新 projects、CI `checks`。
- 新增 `.claude/agents/`、`.claude/skills/`、`docs/prd/`、`.github/` 範本（PR #46 已合併，main 5d47e88）。
- 原型快照換成 PR #47、#48 之後的 main（`/app/` 轉址、實用版骨架 `/live/`）。
- 新增 `docs/design/`、`supabase/`（jjj 區，PR 合併後）。

## 進行中

| 任務 | 步驟 | 狀態 | 時間 |
|---|---|---|---|
| 實用版拆分 | 1～5 ✅／6 LINE Login 設定 ⏸（K.Y. 回家做）／7 程式與測試 ✅，PR 等「合併」 | 等確認 | 11/26 13:20 |

## 之後要做

| 時間 | 項目 |
|---|---|
| 12/11 起（已排提醒） | 實用版第三階段：主線接真實資料（US-01～US-12）；LINE 第二批（S2、P2、P5～P7） |
| 12/14 | 實用版 MVP 里程碑 |
| 12/16 | 決選交件 |

## IP：揪揪一家人（2026/11/26）

| 項目 | 狀態 |
|---|---|
| 角色定裝（頭頂小揪揪＋愛心髮圈） | ✅ 確認；示意總表 S06 |
| 周邊（帽兜抱枕毯＋9 款） | ✅ 確認；示意總表 S05 第三版 |
| 角色規範與周邊企劃 | ✅ `docs/design/揪揪一家人_角色規範與周邊企劃.md` |
| LINE 貼圖改新造型、輸出 PNG | ⬜ 說「輸出」時做 |
| 正式商標與角色檢索 | ⬜ 正式使用前要做 |
