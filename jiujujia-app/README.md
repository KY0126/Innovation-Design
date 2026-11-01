# 揪居家 jiujujia-app

「人工智慧增強軟體工程」學期專案：把 InnoConnect 全國電子「揪居家」提案的原型，做成能登入、能存資料的 Next.js + Firebase MVP。

- 規格與範圍：`ARCHITECTURE.md`　用語：`GLOSSARY.md`　需求：`docs/issues/`
- GitHub Copilot App 設定（專案憲法、skill、agent）說明：`docs/copilot-kit.md`

## 第一次在自己電腦上跑

以下指令都在 repo 的 `jiujujia-app/` 資料夾執行。

需要 Node.js 22 以上、Java 21 以上（Firebase 模擬器要用）。

```shell
npm install
npm install -g firebase-tools   # 第 8 週教材：安裝 Firebase CLI
```

開兩個終端機：

```shell
# 終端機 1：啟動 Auth + Firestore 模擬器（介面在 http://127.0.0.1:4000）
npm run emulators

# 終端機 2：啟動網站（http://localhost:3000）
npm run dev
```

沒有 `.env.local` 時，網站會自動連到模擬器，資料都是假的，關掉就清空。

## 改連真的 Firebase 專案

1. 在 Firebase 主控台建立專案，地區選台灣（asia-east1），開啟 Authentication（Email/密碼、Google）與 Firestore。
2. 新增 Web App，把 `firebaseConfig` 填進 `.env.local`（從 `.env.local.example` 複製）。
3. 把 `.firebaserc` 的 `default` 改成你的專案 ID，部署安全規則：`firebase deploy --only firestore:rules`。

程式碼不用改，只差設定檔。

## 常用指令

| 指令 | 用途 |
|---|---|
| `npm run lint` / `npm run typecheck` | 程式碼檢查 |
| `npm run test:unit` | 單元測試（不需模擬器） |
| `npm run test:rules` | 安全規則測試（自動啟動 Firestore 模擬器） |
| `npm run test:e2e` | 端對端測試（自動啟動模擬器與網站） |
| `npm run check:glossary` | 用語檢查（依 GLOSSARY.md） |

## 目前進度

- [x] #1 登入、註冊與選擇身分（Email/密碼、Google；只開放家人、長輩自行註冊）
- [ ] #2 建立長輩家與邀請長輩加入（6 碼邀請碼，只有長輩本人能加入）
- [ ] #3～#10 見 `docs/issues/README.md`
