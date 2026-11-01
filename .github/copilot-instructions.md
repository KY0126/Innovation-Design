# 揪居家 (Jiujujia) — Project Instructions
- Repo layout: the Next.js MVP lives in `jiujujia-app/` (run npm/firebase there; paths in its ARCHITECTURE.md, agents and skills are relative to it); AI顧問阿國 (阿國), the only AI in this repo, lives in `jiujujia-agent/` (Python, ARCHITECTURE.md §7). Never modify the static prototype (root `*.html`, `jiujujia/`, `demo/`, `e2e/`): its URLs are printed as QR codes in the proposal.
- Stack: Next.js App Router, TypeScript strict, Tailwind + shadcn/ui, Firebase Auth + Firestore, Vitest, Playwright.
- Read `jiujujia-app/ARCHITECTURE.md` before touching data models, domain boundaries, or `firestore.rules`.
- All user-facing text and all replies to the user: Traditional Chinese (Taiwan). Use terms exactly as in `jiujujia-app/GLOSSARY.md`.
- Domains: `customer` and `store` never import each other's code or write each other's collections; cross only via the contracts in ARCHITECTURE.md §3.
- Domain rules: money is integer TWD (no floats); no work order without elder consent (elder's own account only); never persist raw AR/scan images.
- Work on one GitHub issue per session. If acceptance criteria are unclear, stop and ask instead of guessing.
- No new npm packages, no `.env*`/secrets in commits, no destructive git commands without approval.
- Before opening a PR, in `jiujujia-app/`: `npm run lint && npm run typecheck && npm run test:unit && npm run check:glossary`.
