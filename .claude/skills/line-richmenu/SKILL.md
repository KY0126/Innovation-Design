---
name: line-richmenu
description: 五子登科 LINE 分頁圖文選單重建或修改流程（選單圖、自動回應、Edge Function、讀回驗證）。要改 LINE 選單圖、按鈕或分頁時使用。
---

# LINE 分頁圖文選單

1. **選單圖**：2500×1724；上方分頁列高 236（「揪居家｜五子登科好康」，亮的那頁白底深字＋深莓底線）；下方 6 格拼圖，邊框單線淡粉。推到分支 `line-assets`（只放圖，不合併進 main）。
2. **自動回應**：每個按鈕文字在 OA Manager 建一組關鍵字回應；示意內容結尾標「（提案示意）」。
3. **建立選單**：Supabase Edge Function `line-richmenu-setup`（POST）。
   - 在 LINE 後台 Messaging API 頁面，用瀏覽器 JS 讀出 Channel ID／secret，直接 POST 給函式；函式換 30 天短效金鑰，用完即丟。
   - 金鑰不經過聊天、不寫進檔案。
   - 重跑會先刪同名選單與別名再重建。
4. **驗證**：同一呼叫加 `"verify": true`，確認預設選單是 `tab-jjj`、兩個別名都在、每張 8 個按鈕。
5. **單元測試**：改了按鈕範圍要同步改 `tests/unit/richmenu.test.mjs`。
6. **紀錄**：更新 zip 的 `10_LINE官方帳號_五子登科/README.md`。
