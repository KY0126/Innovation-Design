---
name: handoff-zip
description: 揪居家交接打包流程（更新 00_交接任務.md、舊版封存、UTF-8 檔名 zip）。使用者說「更新 zip」「更新交接」時使用。
---

# 交接打包

1. **解壓**到工作資料夾；先把要被取代的檔案複製到 `舊版/vN/`。
2. **更新** `00_交接任務.md`：最後更新時間與摘要、目前階段、檔案表、當日紀錄與下一步。
3. **換檔**：計畫書（07）、原型快照（`git archive origin/main` 到 08）、LINE（10）等；新資料夾要先列清單問使用者（C10）。
4. **打包**：用 Python `zipfile`（中文檔名自動帶 UTF-8 旗標，Windows 才看得到），`testzip()` 檢查。
5. **舊 zip** 移到 `outputs/舊版/<檔名>_<MMDD_HHMM>.zip`，不覆蓋。
6. **交付**：SendUserFile 附上 zip 與最新計畫書。
