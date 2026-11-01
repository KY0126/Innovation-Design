## 變更內容
-

## 對應 issue
Fixes #

## 領域
- [ ] customer　- [ ] store　- [ ] shared（需架構守門員審查）

## 驗證
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run check:glossary`
- [ ] `npm run test:rules`（有改 firestore.rules 時）
- [ ] `npx playwright test`

## 領域鐵律自我檢查
- [ ] 金額都是整數新台幣
- [ ] 沒有長輩同意不會建立派工單
- [ ] 沒有儲存 AR 原始影像；照片只在 photoConsent 為 true 時上傳
- [ ] 沒有跨領域直接 import 或寫入對方的集合
