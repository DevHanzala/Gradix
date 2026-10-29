# Phase 3 progress

Branch `phase-3`, created from `main` at `00deb75`. One commit per numbered section.
Phase 1 and Phase 2 reports were removed from the working tree in `0004f0f`; read them with
`git show 0004f0f^:AUDIT.md`, `git show 0004f0f^:PHASE1_REPORT.md`, `git show 0004f0f^:PHASE2_REPORT.md`.

Gate after every section: `npm run lint`, `npm run i18n:check`, `npm run build`, `npm test`.

## Status

| Section | Status | Commit |
|---|---|---|
| 0. Leftovers and providers | done | 8d51a8d, f9fbeaf, 164dc53, fa233fb, 0a376f0, 132d372, (0.5 commit) |
| 1. File storage (R2) | in progress | |
| 2. Live classroom mode | not started | |
| 3. Engagement: game mode, polls, exit tickets | not started | |
| 4. More question types | not started | |
| 5. Light proctoring and exam controls | not started | |
| 6. Polish, help and accessibility | not started | |
| 7. Plans and usage limits | not started | |
| 8. Production readiness (Render free tier) | not started | |
| 9. Load test | not started | |
| 10. Pilot kit and FYP deliverables | not started | |
| Final verification | not started | |

## Next

Section 1: storage abstraction (local disk / R2), move every stored file, signed URLs, migration script.

## Decisions

- **D0.1** Publishing with objectives that get no question returns 409 `UNCOVERED_OBJECTIVES`; the publish
  dialog lists the count and confirming the dialog sends `allowUncoveredObjectives: true` (the confirmation
  is the dialog itself, no extra checkbox). "Uneven coverage" means tested objectives differ by 2 or more
  questions; it is an info alert, not a block, because weights make unevenness intentional.
- **D0.2a** firebase 12 -> 13 kept. firebase 13 still pins `@grpc/grpc-js` 1.9 inside firestore, so a scoped
  override lifts it to ^1.14.6. Gradix never imports firestore (only `firebase/app` + `firebase/auth`).
  Google sign-in was not clicked through live after the upgrade (build + API compatibility only).
- **D0.2b** uuid inside exceljs: scoped override to ^11.1.1 instead of npm's suggested exceljs downgrade.
- **D0.2c** office-text-extractor v4 was not taken: it still pins a vulnerable file-type (21.1). A scoped
  override gives v3 file-type ^22.2.0 instead. Result: `npm audit --omit=dev` = 0 vulnerabilities.
- **D0.3** YouTube now returns an empty body for caption URLs fetched outside its own player (they need a
  browser-only token). Impersonating YouTube's Android client to get around that was rejected (it bypasses
  a bot check). Instead the instructor gets a clear 422 telling them to paste the transcript as a text file,
  and the live test (`YOUTUBE_LIVE_TEST=true`) documents the current failure.
- **D0.4a** Gemini first, Groq only as the fallback (one Groq attempt after up to 3 Gemini keys), for every
  text purpose. OCR (images) and embeddings are Gemini-only. Previously calls were shuffled over all keys.
- **D0.4b** `GEMINI_API_KEYS` (comma list) and `GEMINI_API_KEY` are added to the existing numbered keys;
  numbered keys keep `gemini-N`, listed keys take the next free numbers. The unused `GEMINI_CHECKING_API_KEY`
  code path was removed (no caller used it), so that variable is no longer required.
- **D0.5** Email provider: explicit `EMAIL_PROVIDER`, else inferred (Brevo key, Resend key, Gmail SMTP).
  Startup requires the settings of the chosen provider only. nodemailer is loaded only for SMTP.

## Open issues

- YouTube transcripts cannot be fetched server-side today (D0.3). Live test fails by design until YouTube
  changes or an official route exists.
