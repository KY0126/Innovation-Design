# ARCHITECTURE — 揪居家 MVP

Agent-facing engineering rules. User-facing wording lives in GLOSSARY.md.

## 1. MVP scope
In scope: 「先評估、再改善」 flow.
陳小姐 creates 林媽媽's home → fills an assessment → system shows red/yellow/green risk per item →
one tap sends it to a 生活顧問 → advisor builds ONE quote → elder consent → advisor dispatches a work order to 全國電子技師 / 協力工班 → acceptance by area.

Substitutes (MVP): AR 量測 is replaced by manual measurement input + optional photo. Night care (後關心) uses simulated events only.
Out of scope: 3D home model, campus ambassador (校園大使), 揪心願, real sensors, payments.
Phase 2 — AI顧問阿國, the single AI advisor (issues #14–#21): see §7 and `docs/roadmap.md`.

## 2. Tech stack & folders
- Next.js App Router (React Server Components by default; `'use client'` only for hooks/browser events), TypeScript strict (no `any`).
- Tailwind + shadcn/ui; merge classes with `cn()`; colors/spacing via CSS variables in `app/globals.css`.
- Firebase: Client SDK `lib/firebase/client.ts` (browser only); Admin SDK `lib/firebase/server.ts` (Server Actions / Route Handlers only, never imported by client code; not used yet in the MVP).
- Emulator vs. real project: with no `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `.env.local`, the client connects to the local emulators (project `demo-jiujujia`). Filling `.env.local` from `.env.local.example` switches to the real project. Code is identical in both modes.
- Tests: Vitest (`tests/unit`), Firestore rules tests with emulator (`tests/rules`), Playwright (`tests/e2e`).

```
app/
  (customer)/            # Domain A routes: 家人 / 長輩
  (store)/               # Domain B routes: 生活顧問 / 技師 / 協力工班 / 企業管理端
components/
  ui/                    # shadcn primitives only
  customer/  store/      # presentational components per domain (no Firestore calls)
lib/
  firebase/              # client.ts, server.ts, converters.ts
  customer/              # Domain A logic: households, assessments, risk rules
  store/                 # Domain B logic: quotes, work orders, dispatch
  shared/                # contracts.ts (shared types), money.ts, roles.ts
types/                   # data models (re-exported from lib/shared/contracts.ts)
tests/ unit/ rules/ e2e/
firestore.rules  storage.rules
```

## 3. Domain boundaries & contracts
| Domain | Owns (writes) | Reads |
|---|---|---|
| customer (A) | `users` (own profile), `households`, `inviteCodes`, `households/{id}/assessments`, consent fields on `quotes` (elder only) | own household, quotes for own household |
| store (B) | `quotes` (except consent), `workOrders`, `careEvents.handledBy` | submitted assessments of households assigned to its store |

Hand-off points (the ONLY cross-domain interfaces, typed in `lib/shared/contracts.ts`):
1. `AssessmentSubmitted` — customer sets `assessment.status = 'submitted'`; store reads it.
2. `QuoteSent` — store sets `quote.status = 'sent'`; customer reads it.
3. `ElderConsent` — the elder (only) sets `quote.status = 'elder_approved'` + `quote.consent`; store may then create a work order.
4. `WorkOrderAccepted` — customer records per-area acceptance on the work order (`acceptance` field only).

Never import from `lib/customer/*` inside `lib/store/*` or vice versa; share types only via `lib/shared/`.

## 4. Data model (Firestore)
```ts
type Role = 'family' | 'elder' | 'advisor' | 'technician' | 'contractor' | 'admin';
users/{uid}:        { role: Role; displayName: string; email: string; storeId?: string; createdAt }
                    // self sign-up may pick only 'family' or 'elder'; store roles are assigned by an admin / seed script
households/{hid}:   { elderName: string; address: string; familyUids: string[]; elderUid: string | null;
                      storeId: StoreId; inviteCode: string; createdBy: string; createdAt;
                      elderJoinedAt?; joinCode? }   // joinCode is written by the elder on join and must equal inviteCode
inviteCodes/{code}: { householdId: string; createdBy: string; claimedBy: string | null; createdAt }
                    // 6 chars from 23456789ABCDEFGHJKLMNPQRSTUVWXYZ (no 0/O/1/I); elder may `get` by code but never `list`
// Stores are a constant in lib/shared/stores.ts for the MVP (Digital City 逢甲 / 公益 / 北屯總站), not a collection.
households/{hid}/assessments/{aid}:
  { status: 'draft' | 'submitted'; submittedAt?;
    items: { area: 'bathroom'|'bedroom'|'hallway'|'living'|'kitchen'|'entrance';
             hazard: string; measurementCm?: number; material?: string;
             photoPath?: string; photoConsent: boolean; risk: 'red'|'yellow'|'green' }[] }
quotes/{qid}:       { householdId; assessmentId; advisorUid; storeId;
                      lineItems: { name: string; unit: 'ping'|'meter'|'set'|'month'; qty: number; unitPriceTwd: number }[];
                      totalTwd: number; status: 'draft'|'sent'|'elder_approved'|'rejected';
                      consent?: { by: string; at } }   // `by` must equal households/{hid}.elderUid
workOrders/{wid}:   { quoteId; householdId; storeId;
                      assignees: { uid: string; type: 'technician'|'contractor' }[];
                      slot: { date: string; period: 'am'|'pm' };
                      status: 'scheduled'|'in_progress'|'done'|'accepted';
                      acceptance?: { area: string; ok: boolean; note?: string }[] }
careEvents/{eid}:   { householdId; type: 'simulated_night_alert'; createdAt; handledBy?: string }   // phase-2, simulated
```

## 5. Domain iron rules (enforce in code AND in firestore.rules)
1. Money: integer TWD only (`unitPriceTwd`, `totalTwd`). Sibling cost split: `floor(total / n)` each, remainder added to the first payer (`lib/shared/money.ts`).
2. Elder consent: a `workOrders` doc can be created only when its quote has `status == 'elder_approved'`. Consent can be written ONLY by the elder's own account (`request.auth.uid == household.elderUid`). Family members and advisors can never write `consent`; if no elder account is linked, the quote cannot be approved.
3. Privacy: raw AR/scan images are never stored. A photo is uploaded only when `photoConsent == true`. Default install plan has no camera.
4. Risk lights: red = 要優先處理, yellow = 建議改善, green = 沒有明顯風險. Rules live in `lib/shared/data/risk-rules.json` (shared with 阿國 and /v2/), loaded by `lib/customer/risk-rules.ts`; thresholds are team-defined and must be covered by unit tests.
5. AI suggestion vs. human decision: AI (「阿國」) may recommend fixes and dispatch candidates; only the 生活顧問 confirms quotes and dispatch.

## 6. Verification before merge
- `npm run lint` · `npm run test:unit` (risk rules, money, converters) · `npm run check:glossary` · `npm run test:rules` (emulator) · `npx playwright test` (critical journeys: 建立長輩家→評估→送顧問, 報價→長輩同意→派工).
- `allow read, write: if true;` is banned in `firestore.rules`.


## 7. AI顧問阿國 (阿國) — the single AI advisor (`jiujujia-agent/`)

Everything AI / LLM / MCP / agent in this repo **is AI顧問阿國** (short: 阿國; first mention in UI and docs uses the full name): one core, one API, many consumers. No other module may call an LLM directly.
Base: the 二階 v1.3 MCP Agent (program checks → verifier agent → reject and retry). Python 3.13 + MCP; LLM behind one adapter (default: Cloudflare Workers AI, Llama 3.3).

### 7.1 Capabilities (one endpoint each, same pipeline)
| Capability | Minimal input | Output | Issue |
|---|---|---|---|
| `assess` | areas, hazards, measurements, materials | risk light per item, fix plan, install method, sources | #16 |
| `quote_draft` | accepted fix plan, measurements | line items from `quote-items.json`, integer TWD | #17 |
| `talk_script` | fix plan or quote summary | 推薦理由、對長輩的說法 | #17 |
| `crew_recommend` | work types, date, slot, crew availability | ranked 全國電子技師／協力工班 with reasons | #18 |
| `wish_classify` | 揪心願 entries | category suggestions | #19 |
| `knowledge_qa` | question | answer with sources (長照 1966, 輔具, 居家安全) | #15 |
| `plan_all` | assessment | coordinator runs assess → quote_draft → crew_recommend | #20 |

Pipeline for every capability: validate input schema → MCP tools / LLM → program checks (schema, catalog membership, arithmetic, agreement with `risk-rules.json`) → verifier agent → pass | one retry | rules-only fallback (`fallback: true`).

### 7.2 Consumers (all call the same 阿國)
1. **二階 `/v2/`** (stage2 branch, static prototype): connection C — results precomputed by `python -m aguo export --demo` into JSON the prototype reads; live mode switched on for enterprise demos.
2. **jiujujia-app (MVP)**: server Route Handlers `app/api/aguo/*` verify the Firebase ID token, load only the needed fields, POST to 阿國, store the reply in `aiSuggestions` (UI label 「AI顧問阿國建議」). From 12/17.
3. **AI 語言模型系統整合 course**: CLI / host demo and evaluation sets in `jiujujia-agent/evals/`.

### 7.3 Layout and shared data
```
jiujujia-agent/
  aguo/api.py            HTTP API: POST /v1/<capability>
  aguo/pipeline.py       schema validation, program checks, verifier agent, retry, fallback
  aguo/capabilities/     assess.py, quote_draft.py, talk_script.py, crew_recommend.py, wish_classify.py, knowledge_qa.py, plan_all.py
  aguo/llm.py            the only LLM adapter
  servers/               MCP servers: rules, knowledge (RAG), schedule
  knowledge/  evals/  tests/  .env.example
jiujujia-app/lib/shared/data/     risk-rules.json, quote-items.json, zones.json  ← single source for TS, Python and /v2/
jiujujia-app/lib/shared/schemas/  JSON Schemas for every capability's request and response
```
Shared business rules from 二階 live in that data, not in code: 異常先問長輩兩次才通知家人; 每區可複選; 補助轉介條件為長照等級第 2 級以上; five zones (四場域＋門口／玄關).

```ts
aiSuggestions/{sid}: { householdId; assessmentId?; quoteId?;
                       capability: 'assess' | 'quote_draft' | 'talk_script' | 'crew_recommend' | 'wish_classify' | 'plan_all';
                       items: unknown[];                       // shape per capability, see lib/shared/schemas
                       sources: { title: string; url: string }[];
                       fallback: boolean; checks: { program: boolean; verifier: boolean; retries: number };
                       model: string; createdAt;
                       status: 'proposed' | 'accepted' | 'dismissed'; decidedBy?: string; decidedAt? }
```

### 7.4 阿國 iron rules (enforce in code, schemas, rules and tests)
1. 阿國 only proposes. Nothing from 阿國 writes `quotes`, `consent` or `workOrders`; people accept a suggestion through the normal domain flow.
2. Data minimization: never send names, addresses, emails, phone numbers, photos or raw AR data to the LLM.
3. Strict schemas both ways: tool inputs reject string booleans/numbers (`"False"`, `"76"`); outputs are validated.
4. Every reply passes program checks and the verifier agent; failure → one retry → rules-only fallback with `fallback: true`. Budget 10 s per capability, 30 s for `plan_all`.
5. Knowledge answers cite sources; no source → say so.
6. User free text is untrusted data in a delimited field, never instructions (prompt injection).
7. Secrets only in `jiujujia-agent/.env`; CI uses a mock LLM and never calls a paid model.
8. One core: a new AI feature is a new capability in `aguo/capabilities/`, never a separate script or service.

### 7.5 Branching
The core is built on `feat/14-aguo-core` (from main). stage2 merges it to power `/v2/`; jiujujia-app branches use it after the 11/16 merge decision. Shared data files are owned by the contract-architect agent.
