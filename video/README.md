# Video Recording — Not Yet Captured

This folder is a placeholder for the required screen recording (`recording.mp4` or a link to a
cloud-hosted video), per the assessment's deliverable C. **It has not been recorded** — that step
requires a human at the keyboard, and this session already did the automated part: both
automation suites are built, debugged, and passing against a live InvenTree instance (API 60/60,
UI 10/10 — see the root `README.md`).

## What the recording needs to show (per the brief)

1. The agent generating test cases from requirements — e.g. re-run the `WebFetch` research calls
   in `agents/prompts.md` §1 and the generation prompt in §3/§4, watching
   `test-cases/ui-manual-tests.md` / `api-manual-tests.md` get written.
2. The agent generating automation scripts from the API spec — the prompt in `agents/prompts.md`
   §5, watching `automation/api/` get built.
3. Test execution — at least a subset of tests running successfully against a live InvenTree
   instance. This repo's suites already do this reliably; running `npm test` in
   `automation/api/` and `automation/ui/` per their READMEs' "Setup" sections is enough to
   capture it live.
4. Any iterative refinement or correction performed on the agent's output — the root `README.md`
   → "Corrections made against the live instance" is the real record of this: 18 concrete fixes
   found by actually running the suites against `docker compose up` and debugging failures
   (wrong endpoint paths, an undocumented required DELETE body, Playwright's Basic-auth
   challenge-response never firing against this API, InvenTree's aria-labels not matching visible
   text, etc.). Walking through a few of those — the failure, the fix, the passing re-run — is
   exactly what this requirement is asking for, and `agents/prompts.md` §7 has the full list to
   narrate from.

## How to add the recording

Either:

- Drop the exported file at `video/recording.mp4`, or
- Replace this file's content with a link to a cloud-hosted recording (Loom, YouTube unlisted,
  Google Drive, etc.), keeping the filename `video/README.md` or adding `video/recording-link.md`.
