# Phase 3 progress

Branch `phase-3`, created from `main` at `00deb75`. One commit per numbered section.
Phase 1 and Phase 2 reports were removed from the working tree in `0004f0f`; read them with
`git show 0004f0f^:AUDIT.md`, `git show 0004f0f^:PHASE1_REPORT.md`, `git show 0004f0f^:PHASE2_REPORT.md`.

Gate after every section: `npm run lint`, `npm run i18n:check`, `npm run build`, `npm test`.

## Status

| Section | Status | Commit |
|---|---|---|
| 0. Leftovers and providers | done | 8d51a8d, f9fbeaf, 164dc53, fa233fb, 0a376f0, 132d372, 957a850 |
| 1. File storage (R2) | done | 3c7716f |
| 2. Live classroom mode | done | 413e41c, 4d5095e |
| 3. Engagement: game mode, polls, exit tickets | done | (section 3 commit) |
| 4. More question types | in progress | |
| 5. Light proctoring and exam controls | not started | |
| 6. Polish, help and accessibility | not started | |
| 7. Plans and usage limits | not started | |
| 8. Production readiness (Render free tier) | not started | |
| 9. Load test | not started | |
| 10. Pilot kit and FYP deliverables | not started | |
| Final verification | not started | |

## Next

Section 4: image questions (upload, compress, alt text, storage), fill in the blank (several blanks,
accepted answers, shared grader, AI generation), matching (pairs, partial credit, AI generation), in every
place: generation/validation, bank, graded exam (adaptive, negative marking), live/practice, review,
reports, analytics, print (PDF/DOCX incl. RTL).

Browser checks: `docs/phase3-evidence/scripts/liveFlow.mjs` and `engagementFlow.mjs` (need `demoServer.mjs`,
a throwaway Postgres in PG* env, and the frontend built with VITE_API_URL=http://127.0.0.1:5056/api served
on 127.0.0.1:5174). Helper scripts for locale merges live in %TEMP%/gradix-tools (the session scratchpad
gets cleaned).

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
- **D1.1** Inventory before section 1: uploads were kept in memory only (originals discarded after text
  extraction), PDF reports were cached as BYTEA in Postgres, and papers/exports were generated and streamed
  per request. Nothing used the server's disk. Now: original uploads are kept (`resources.storage_key`),
  reports live in storage (`learning_reports.pdf_storage_key`; the BYTEA column is emptied by
  `npm run storage:migrate` or on first download). Papers (PDF/DOCX) and CSV/Excel exports stay generated
  on demand and streamed: they are never written anywhere, so they cannot be lost on a restart, and storing
  them would only use R2 space for copies that go stale when the assessment changes. OCR page images are
  rendered in memory from the stored original and never kept. Question images (section 4) use storage.
- **D1.2** Signed URLs live 5 minutes. R2: presigned GET straight to R2 with Content-Disposition (Urdu file
  names via RFC 5987). Local driver: `/api/files/<key>?e&n&t&s`, HMAC-SHA256 with `STORAGE_SIGNING_SECRET`
  (default `JWT_SECRET`). The report endpoint keeps returning bytes by default (backward compatible);
  `?as=link` returns the signed link, which the UI now uses.
- **D1.3** Storage keys use ASCII-only file names (`نوٹس.pdf` -> `file.pdf`); the real name is kept in the
  DB and restored in the download's Content-Disposition.
- **D2.1** Commands are REST, Socket.IO only pushes. Every screen rebuilds from `GET /api/live/me` (participant)
  or `GET /api/live/sessions/:id` (teacher), so a dropped socket, a reload or a server restart loses nothing.
  Only public state changes (start, next, pause, resume, reveal, time up, end) are broadcast to the whole
  room; answers and joins only refresh the teacher board, throttled to one push per 400 ms per session.
- **D2.2** "Correct answers only at reveal": teacher-paced = when the teacher presses Show answer;
  student-paced = after that student has answered (or their time ran out) for that question. The teacher's
  own board shows the correct answer during the question; the projector view does not.
- **D2.3** A teacher-paced question closes automatically when every active participant has answered, or
  at its deadline (+750 ms grace for network latency). Pause stores the remaining time; resume restarts it.
- **D2.4** Guests get a participant token signed with a different secret (`JWT_SECRET + ":live-participant"`),
  valid 12 h, accepted only by `/api/live/me*` and the socket. It can never authenticate as a user, so guests
  cannot reach graded exams. A removed participant's token stops working; the nickname becomes free.
- **D2.5** Duplicate nicknames get a number ("Ali 2"), case-insensitively. Anonymous names ("Student N") are
  a session setting. Join is rate-limited per IP at 300/min (a whole class often shares one school IP).
- **D2.6** Unique-per-student mode needs an assessment bank (AI quick sets are one shared set). Each
  participant gets their own snapshot spread over objectives with no repeats; a small bank is reused rather
  than leaving a student without questions.
- **D2.7** Scoring: correct = 500 + up to 500 for speed + 100 per streak step (max +500); wrong = 0. Points
  are shown only in game mode; results always show correct/answered and accuracy. "Struggling" = at least 2
  answers and accuracy <= 50%, or the last two wrong.
- **D2.8** Results appear in the instructor's Live sessions list (participants, % correct) and on the session
  board after it ends, with CSV export (UTF-8 BOM, formula injection neutralised). Live sessions are not
  mixed into graded-exam analytics, because they are ungraded practice.
- **D3.1** Polls and exit tickets are one table (`live_polls`, kind single/multiple/text/exit_ticket), one open
  poll per session (opening a new one closes the old), one response per participant, never graded. Anonymous
  polls hide names from the teacher too; participants never see other people's answers.
- **D3.2** The exit ticket stores no text: its three prompts (understanding 1-5, one thing learned, one
  question) come from the UI catalogs in the *session's* language, whatever the student's UI language is.
- **D3.3** Team race: 2-6 numbered teams, balanced automatically on join, teacher can move people. Progress =
  team's correct answers / (members x questions), so a bigger team does not win by size.
- **D3.4** Sounds are synthesised with Web Audio (no files to download): right/wrong at reveal on phones, a
  fanfare at the podium on phones and the projector; only when the session's Sounds setting is on.
- **D1.4** The AWS SDK v3 S3 client is used for R2 (lazy-loaded only when `STORAGE_DRIVER=r2`). Verified
  against Adobe S3Mock in Docker (put, list, get, presigned GET with the Urdu filename, delete). MinIO
  images are no longer published on Docker Hub/Quay, hence S3Mock; S3Mock does not check signatures, so
  signature tampering is covered by real R2 behaviour and the presign unit test only.

## Open issues

- YouTube transcripts cannot be fetched server-side today (D0.3). Live test fails by design until YouTube
  changes or an official route exists.
