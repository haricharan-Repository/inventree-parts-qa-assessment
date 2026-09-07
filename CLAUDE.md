# Project instructions for Claude Code

This repo is a QA deliverable for the InvenTree **Parts module** (Python/Django app,
`https://github.com/inventree/InvenTree`). Full narrative and rationale: `README.md`,
`agents/system-instructions.md`, `agents/prompts.md`.

## Ground truth

- Requirements: `agents/context/parts-requirements-summary.md` (ingested from
  `docs.inventree.org/en/stable/part/*`).
- API schema: `agents/context/api-schema-summary.md` (ingested from
  `docs.inventree.org/en/stable/api/schema/part/`).
- Anything in either file marked `[inferred]` was not confirmed by a fetched doc page or a live
  instance — verify before treating it as authoritative, and update the mark once confirmed.

## Working rules

- **Don't invent InvenTree behaviour.** If a rule isn't in the context files above or confirmed
  against a running instance, either fetch the relevant doc page or mark the addition
  `[inferred]`.
- **Test-case IDs are the contract.** `test-cases/ui-manual-tests.md` and
  `test-cases/api-manual-tests.md` use stable IDs (`PC-01`, `API-P-01`, ...). Automation spec
  files reference these IDs in comments/test names — keep that mapping intact when editing either
  side; update both together.
- **Automation must stay runnable.** `automation/api` and `automation/ui` are separate npm
  projects (TypeScript + Playwright). After any code change: `npx tsc --noEmit` in the changed
  project before considering the change done. Prefer actually running the affected spec against a
  live instance (`docker compose up` from a cloned InvenTree repo, default
  `http://localhost:8000`) over trusting the type-checker alone.
- **UI selectors are the known-fragile part.** `automation/ui/pages/*.ts` were written from
  documented labels, not a live DOM (see `automation/ui/README.md` → "Known gap"). When a
  selector fails against a real instance, fix it in the Page Object, not by adding sleeps/retries
  around it.
- **Document corrections.** Any fix to agent-generated output goes in `README.md` →
  "Corrections to agent output" (what changed and why), and the underlying prompt/approach that
  produced the issue gets a note in `agents/prompts.md` if it would recur.
- **No fixed sleeps in Playwright code.** Use `expect(...)` auto-retrying assertions,
  `waitForURL`, or role/label-based locators that wait implicitly.

## Environment

- Node/TypeScript for both automation projects; no shared root `package.json` — `cd` into
  `automation/api` or `automation/ui` before running npm/npx commands.
- Target InvenTree instance is not part of this repo — it's a separate `docker compose up`
  checkout. Never commit InvenTree source or its containers' data into this repo.
