---
name: firestore-rules
description: "Write and test 揪居家 Firestore security rules (role-based access, elder-consent gate, photo consent) with the Firebase emulator. Use whenever firestore.rules or a collection's access pattern changes."
---

# Firestore rules for 揪居家

## Steps
1. Read ARCHITECTURE.md §3 (who owns which collection) and §5 (iron rules). Rules must enforce them, not just the UI.
2. Edit `firestore.rules` using helper functions:
   - `signedIn()`, `role()` (reads `users/{uid}.role`), `isFamilyOf(hid)`, `isElderOf(hid)`, `isAdvisorOf(storeId)`.
3. Required rules:
   - `households` / `assessments`: write by family or elder of that household only; advisors of the household's store may read submitted assessments.
   - `quotes`: advisors of the store create/update everything EXCEPT `consent` and the `elder_approved` transition; ONLY the household's elder (`request.auth.uid == household.elderUid`) may set `status` + `consent`. Family members may read but never approve.
   - `workOrders`: create only if `get(quote).data.status == 'elder_approved'`; customer may update only `acceptance`.
   - `assessments.items[].photoPath` may be set only when that item's `photoConsent == true` (validate in Storage rules too).
   - Banned: `allow read, write: if true;` and any wildcard match that skips role checks.
4. Tests in `tests/rules/*.test.ts` with `@firebase/rules-unit-testing`. For each rule write one allowed case and one denied case, including:
   - advisor tries to write `consent` → denied
   - family member (not the elder) tries to approve a quote → denied
   - work order on a `sent` (not approved) quote → denied
   - user from another household reads an assessment → denied
5. Run `firebase emulators:exec "npm run test:rules"`; fix and re-run until all pass.

## Done when
- Every iron rule in ARCHITECTURE.md §5 has at least one denied-path test, and the suite passes.
