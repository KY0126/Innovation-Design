---
name: qa-workflow
description: "Run the 揪居家 QA loop (lint, Vitest, glossary check, Playwright) and fix failures until green. Use before declaring an issue done or opening a PR."
---

# QA loop

Run in order; after each failure, fix the root cause and re-run only that step before moving on.

1. `npm run lint` — fix type and lint errors; never silence with `any` or `eslint-disable`.
2. `npm run test:unit` — read the failing assertion; fix logic in `lib/`, or update the test only if the issue's acceptance criteria changed.
3. `npm run check:glossary` — replace each reported term with the 使用 column of GLOSSARY.md. Do not edit GLOSSARY.md to make the check pass.
4. `npm run test:rules` — only if `firestore.rules` or `storage.rules` changed.
5. `npx playwright test` — make sure the dev server or test server is reachable first; for a failure, re-run just that spec: `npx playwright test tests/e2e/<file>.spec.ts`.

## Rules
- Stop after 3 failed fix attempts on the same error and report what you tried; do not loop.
- Report a short table: step / result / what was fixed.

## Done when
All commands exit with code 0.
