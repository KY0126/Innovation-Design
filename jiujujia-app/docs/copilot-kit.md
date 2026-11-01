# 揪居家 Copilot 工具包｜使用說明

這包是給「人工智慧增強軟體工程」學期專案用的 GitHub Copilot App 設定：一份專案憲法、架構與用語文件、4 個共用 skill、7 個角色 agent（5 個對應組員分工，2 個負責阿國），再加上一支用語檢查腳本和 CI 設定。

## 檔案結構

放在 `Innovation-Design` repo 裡：Copilot 只會讀 repo 根目錄的 `.github/` 和 `.agents/`，程式放在 `jiujujia-app/` 子資料夾。原型（根目錄的 `*.html`、`jiujujia/`、`demo/`、`e2e/`）完全不動，提案書 QR Code 的網址不受影響。

```
.github/                         （repo 根目錄）
  copilot-instructions.md        專案憲法，每次對話都會送出，所以只有 9 條規則
  agents/                        7 個角色 agent（5 個組員分工＋2 個阿國）
    spec-owner.agent.md            產品與規格設計師
    contract-architect.agent.md    脈絡架構與合約守門員
    customer-builder.agent.md      領域全端協作者 A（顧客端）
    store-builder.agent.md         領域全端協作者 B（門市端）
    integration-reviewer.agent.md  系統整合與體驗防禦者
    aguo-builder.agent.md          阿國開發者（jiujujia-agent/）
    aguo-reviewer.agent.md         阿國安全審查
  skills/                        4 個共用 skill（所有 agent 都能用）
    scaffold-feature/SKILL.md      依架構建立功能模組與測試骨架
    firestore-rules/SKILL.md       寫安全規則並用模擬器測試
    qa-workflow/SKILL.md           lint → 單元測試 → 用語檢查 → E2E，修到全綠
    pr-preflight/SKILL.md          PR 前清理、Conventional Commits、PR 說明
  ISSUE_TEMPLATE/user-story.md   User Story + Given-When-Then 範本
  pull_request_template.md       PR 範本（含領域鐵律自我檢查）
  workflows/jiujujia-app-ci.yml  GitHub Actions：jiujujia-app/ 有變動的 PR 自動檢查
  workflows/e2e.yml              原有的原型測試（沒改）
.agents/skills/                  5 個 Firebase 官方 skill（npx skills add 安裝）
jiujujia-app/                    Next.js + Firebase MVP
  ARCHITECTURE.md                MVP 範圍、資料夾、領域邊界、資料模型、領域鐵律
  GLOSSARY.md                    揪居家用語表＋台灣用語表
  scripts/check-glossary.mjs     讀 GLOSSARY.md 的禁用詞，掃描程式碼
  docs/issues/                   #1～#10 的 User Story
```

設計依照課程教材：

- copilot-instructions.md 每次都會送出，所以只放最重要的 9 條，細節放在 ARCHITECTURE.md。
- skill 的說明每次也會送給 agent，所以只做 4 個所有角色都用得到的。只有某個角色用得到的流程，寫在該角色的 .agent.md 裡，不另外做成 skill。
- 給 agent 看的規則用英文寫，使用者看得到的文字一律繁體中文，並照 GLOSSARY.md 用詞。

## 安裝步驟

專案已經建好，以下是當初的步驟，給之後的專案參考：

1. 在 repo 裡的子資料夾 `jiujujia-app/` 執行 `npx create-next-app .`；`npm audit fix`（不加 `--force`，會把 ESLint 降版）。
2. Copilot 設定放 repo 根目錄 `.github/`；架構、用語、腳本放 `jiujujia-app/`。
3. 安裝 Firebase skill（在 repo 根目錄）和 CLI（第 8 週教材）：
   ```shell
   npx skills add firebase/agent-skills -s firebase-auth-basics -s firebase-basics -s firebase-firestore -s firebase-security-rules-auditor -s firestore-rules-creation -a github-copilot --copy -y
   npm install -g firebase-tools
   firebase login
   ```
4. 在 GitHub Copilot App 用「Add GitHub repository」或「Clone repository」接上 `Innovation-Design`，**開一個新 session**，輸入 `/agent` 就能看到 7 個角色。agent 跟 session 綁定，加了新 agent 要開新 session 才看得到。

## 怎麼使用

**skill**：不用特別呼叫，agent 判斷任務需要時會自動載入；也可以在 prompt 裡直接寫出 skill 名稱。

**agent**：開 session 時，先用 `/agent` 切換角色，再下 prompt。

這門課只有凱一人修，所以採「一人＋7 個 agent」模式：agent 當虛擬組員，凱負責下指令和做最後決定。建議每個 issue 照這個順序換角色：spec-owner 檢查 issue → builder 開發 → integration-reviewer 審查 PR；阿國的 issue 改成 aguo-builder 開發 → aguo-reviewer 審查。這樣即使只有一個人，規格、開發、審查也是由不同角色把關，不會「自己寫、自己改」。

| 角色 | 選這個 agent | 主要工作 |
|---|---|---|
| 產品與規格設計師 | spec-owner | 把提案內容寫成 issue、檢查 issue 夠不夠清楚、守住範圍 |
| 脈絡架構與合約守門員 | contract-architect | 維護架構文件、資料模型、安全規則；agent 寫歪時修正上下文 |
| 顧客端負責人 | customer-builder | 建立長輩家、評估、紅黃綠燈、送顧問、長輩同意、驗收 |
| 門市端負責人 | store-builder | 看評估、整合報價、長輩同意後派工、技師排程 |
| 整合與體驗防禦者 | integration-reviewer | 審查 PR、維護兩條 E2E 主流程 |
| 阿國開發者 | aguo-builder | 在 `jiujujia-agent/` 實作阿國的能力、MCP server、評估題組 |
| 阿國安全審查 | aguo-reviewer | 審查阿國的 PR：個資、prompt injection、參數型別、備援 |

## 範例 prompt（已照課程規則寫好，可直接貼）

**1. 寫 issue（spec-owner，Chat 或 Plan 模式）**
```
Draft GitHub issues for epic "居家評估" (customer domain).
Users: 陳小姐, 林媽媽. Follow .github/ISSUE_TEMPLATE/user-story.md.
Max 4 issues. Output issue bodies only; do not create files or issues yet.
```

**2. 檢查 issue（spec-owner）**
```
Readiness check for issue #3 only. List missing behavior, unclear boundaries,
missing error handling, and questions for the team. Do not write code.
```

**3. 開發（customer-builder，先用 Plan 模式）**
```
Implement issue #3 only. Use scaffold-feature. Touch only customer-domain paths.
Plan first: list files and tests, then wait for my approval.
```

**4. 改資料模型或規則（contract-architect）**
```
Add field `photoConsent` to assessment items per issue #7.
Update lib/shared/contracts.ts, converter, ARCHITECTURE.md §4, and firestore.rules
with tests via firestore-rules skill. One PR.
```

**5. 審查 PR（integration-reviewer）**
```
Review PR #12. Follow your checklist. Blockers first, then nits. Verdict at the end.
```

**6. 收尾（任何 builder）**
```
Run qa-workflow, then pr-preflight. Then Agent merge.
```

省額度的提醒：

- 換一個 issue 就 `/clear` 或開新 session。
- 簡單的事用 Auto 的 Efficiency。
- `npm audit fix`、`npm run dev` 這種一行指令自己在 terminal 打，不要叫 agent 做。

## 已定案與待確認

- **長輩同意（已定案）**：只有長輩本人的帳號能按同意，家人和生活顧問都不行。長輩要先用邀請碼加入長輩家。
- **紅黃綠燈的判斷門檻（暫定）**：`lib/customer/risk-rules.ts` 裡的數值目前是暫定值，標註「待確認」，之後可依訪談或文獻修改，改了要一起改測試。
- **MVP 範圍（暫定）**：AR 量測先改成手動輸入尺寸加照片，夜間關懷用模擬事件。要調整的話改 ARCHITECTURE.md §1。
