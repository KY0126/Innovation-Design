---
name: proposal-figure-swap
description: 決選構想計畫書換圖流程（封存、截圖、貼回原位、重建 Word／PDF、核對頁數、更新 zip）。要換計畫書裡的圖或某一格時使用。
---

# 計畫書換圖

1. **封存**：舊圖另存 `figs/<圖名>_<MMDD>改前.png`；舊 Word／PDF 存到 `決選v2/舊版/<MMDD_HHMM>/`。
2. **截圖**：原型畫面用 Playwright（手機 390×844、deviceScaleFactor 2；3D 加 `--use-gl=swiftshader`），用示範帳號走到該畫面。
3. **貼回原位**：量出原格位置（內容區的左上、寬高），新截圖依寬度等比縮放貼上；格子底部被切到的文字用白色蓋掉；編號徽章從舊圖取回疊上。
4. **重建**：`NODE_PATH=/opt/node-tools/node_modules node build.js <md> <docx>`，再 `soffice --headless --convert-to pdf`。
5. **核對**：PDF 頁數與改前相同；圖所在頁目視檢查（pdftoppm 轉圖看）。
6. **交付**：Word、PDF 給使用者；同步更新最終版 zip 的 `07_決選構想計畫書_v2/` 與交接文件紀錄。
