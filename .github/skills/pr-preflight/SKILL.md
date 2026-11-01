---
name: pr-preflight
description: "Pre-PR hygiene for 揪居家 — clean diff, Conventional Commits, PR body from the template linked to its issue. Use right before Agent merge or Create PR."
---

# PR preflight

1. `git status` and `git diff --staged`: remove `console.log`, commented-out code, temp mocks; confirm no `.env*`, service-account JSON, or keys.
2. Confirm the diff stays inside the issue's domain (`customer`, `store`). If `lib/shared/` or `firestore.rules` changed, add the label `needs-architect-review`.
3. Commit messages: Conventional Commits — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`; one logical change per commit; write the summary in English.
4. Branch name: `feat/<issue-number>-<short-name>` or `fix/<issue-number>-<short-name>`.
5. PR body: fill `.github/pull_request_template.md` in zh-TW; include `Fixes #<issue>`; tick only checks you actually ran (run the qa-workflow skill first if not).
6. If the work added behavior not described in the issue, open a new issue for it and link it, so every shipped feature is recorded.
