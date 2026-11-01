---
name: scaffold-feature
description: "Scaffold a new 揪居家 feature module inside one domain (customer or store) following ARCHITECTURE.md folders, shared contracts, and test skeletons. Use when starting implementation of a user-story issue."
---

# Scaffold a feature module

## Inputs
- `domain`: `customer` or `store` (from the issue's 領域 checkbox).
- `feature`: kebab-case name, e.g. `household-setup`, `quote-builder`.
- `issue`: GitHub issue number.

## Steps
1. Read the issue and list its Given-When-Then criteria. If any criterion is missing or ambiguous, STOP and ask; do not invent behavior.
2. Check `lib/shared/contracts.ts` for the types this feature needs. If a cross-domain type is missing, STOP: changes to `lib/shared/` belong to the contract-architect agent.
3. Create only what the feature needs:
   - `app/(<domain>)/<feature>/page.tsx` — route; Server Component unless hooks are required.
   - `components/<domain>/<feature>/` — presentational components; data via props only, no Firestore calls.
   - `lib/<domain>/<feature>.ts` — Firestore reads/writes using `withConverter<T>()` from `lib/firebase/converters.ts`.
   - `tests/unit/<domain>/<feature>.test.ts` — one test per Given-When-Then criterion (`it.todo` is fine at first).
   - `tests/e2e/<feature>.spec.ts` — only if the issue describes a user journey.
4. UI primitives: reuse `components/ui/*`; if missing, run `npx shadcn@latest add <component>`.
5. All visible text in zh-TW using GLOSSARY.md terms.

## Done when
- No component imports Firestore directly; no import crosses `lib/customer` ↔ `lib/store`.
- Every acceptance criterion maps to at least one test (todo or real).
