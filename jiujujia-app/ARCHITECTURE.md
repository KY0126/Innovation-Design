# ARCHITECTURE — 揪居家 MVP

Agent-facing engineering rules. User-facing wording lives in GLOSSARY.md.

## 1. MVP scope
In scope: 「先評估、再改善」 flow.
陳小姐 creates 林媽媽's home → fills an assessment → system shows red/yellow/green risk per item →
one tap sends it to a 生活顧問 → advisor builds ONE quote → elder consent → advisor dispatches a work order to 全國電子技師 / 協力工班 → acceptance by area.

Substitutes (MVP): AR 量測 is replaced by manual measurement input + optional photo. Night care (後關心) uses simulated events only.
Out of scope: 3D home model, campus ambassador (校園大使), 揪心願, real sensors, payments.

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
4. Risk lights: red = 要優先處理, yellow = 建議改善, green = 沒有明顯風險. Rules live in `lib/customer/risk-rules.ts` as data; thresholds are team-defined and must be covered by unit tests.
5. AI suggestion vs. human decision: AI (「阿國」) may recommend fixes and dispatch candidates; only the 生活顧問 confirms quotes and dispatch.

## 6. Verification before merge
- `npm run lint` · `npm run test:unit` (risk rules, money, converters) · `npm run check:glossary` · `npm run test:rules` (emulator) · `npx playwright test` (critical journeys: 建立長輩家→評估→送顧問, 報價→長輩同意→派工).
- `allow read, write: if true;` is banned in `firestore.rules`.
