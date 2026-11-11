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
| 3. Engagement: game mode, polls, exit tickets | done | 5a29580 |
| 4. More question types | done | 6a4109f, af0ea15; browser check e1cb091 |
| 5. Light proctoring and exam controls | done | 60e6e95 |
| 6. Polish, help and accessibility | done (Sindhi partial) | ea2986e |
| 7. Plans and usage limits | done | 0b0328a |
| 8. Production readiness (Render free tier) | done (512 MB container run pending) | 0b0328a, 75c810b |
| 9. Load test | done (local, single-connection DB) | 75c810b |
| 10. Pilot kit and FYP deliverables | done | e415e96 |
| Final verification | done | e1cb091 + final commit |

## Next

Phase 3 is complete; see PHASE3_REPORT.md and FINAL_STATUS.md (your to-do list).

Browser checks: `docs/phase3-evidence/scripts/liveFlow.mjs` and `engagementFlow.mjs` (need `demoServer.mjs`,
a throwaway Postgres in PG* env, and the frontend built with VITE_API_URL=http://127.0.0.1:5056/api served
on 127.0.0.1:5174). Locale merge helper: %TEMP%/gradix-tools/addkeys.py. In Git Bash set
MSYS_NO_PATHCONV=1 for commands containing regexes like /x|y/, and write files with non-ASCII text using
the file tool rather than heredocs.

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
- **D4.1** Fill in the blank: `[[n]]` markers in the stem, accepted answers per blank, all blanks must be right
  (no partial credit). Matching: right column stored shuffled, pairs in correct_answer, partial credit on by
  default (configurable per question); negative marks only when no pair is right.
- **D4.2** Images are an attribute of any question (plus one per MCQ option), not a separate type. Uploads are
  resized to 1280 px WebP; alt text is required. API responses carry {key, url, alt}; image links live 1 hour
  (documents 5 minutes) because a question can stay on screen for minutes. DOCX gets PNG copies (Word has no WebP).
- **D4.3** Practice adds fill-in-the-blank and matching only for assessments that use those types.
- **D5.1** Exam controls live in `assessments.exam_settings` and are editable at any time (also after
  publishing) from the assessment page; they apply to attempts that start afterwards. A running attempt is never
  cut off by the window; the window only governs starting. Late join = latest start after windowStart.
- **D5.2** Copy/paste/context menu are blocked in every graded exam; only when proctoring is on are the events
  recorded. Window blur is only counted while the tab is visible (switching tabs counts once, as tab_hidden).
- **D5.3** Extra time multiplies every question's time for that student (1x-3x), snapshotted on the attempt at
  start. Option shuffling is per question when served (default on); grading uses option text.
- **D1.4** The AWS SDK v3 S3 client is used for R2 (lazy-loaded only when `STORAGE_DRIVER=r2`). Verified
  against Adobe S3Mock in Docker (put, list, get, presigned GET with the Urdu filename, delete). MinIO
  images are no longer published on Docker Hub/Quay, hence S3Mock; S3Mock does not check signatures, so
  signature tampering is covered by real R2 behaviour and the presign unit test only.

- **D6.1** The onboarding tour runs once per user (stored per user id in the browser), can be skipped and replayed
  from the Help menu. Help content lives in the UI catalogs, so it is translated like every other string.
- **D6.2** The service worker caches static files only, never API responses: an exam must never show a stale
  question or a cached answer. Offline, the app shows an offline page; saving answers still retries as before.
- **D6.3** Sindhi uses the Naskh font (Nastaliq is wrong for Sindhi) and is marked PARTIAL in the i18n check, so
  missing keys fall back to English without failing CI. Machine-filled strings are listed for native review.
- **D7.1** The effective plan is the better of the user's own plan and their groups' plans. Limits are checked when
  something new starts (assessment, enrollment, publish, AI quick set, upload, joining a live session); nothing
  already running is ever stopped. There is no payment gateway; the Super Admin assigns plans.
- **D8.1** Production fits 512 MB by moving embeddings and OCR to Gemini (same 384-d column, so no schema change;
  token counts are estimated), loading heavy libraries on first use, running jobs one at a time inside the API, and
  rendering PDFs one at a time with chrome-headless-shell (peak 327 MB vs 401-452 MB with full Chrome).
- **D8.2** Sentry is optional and scrubbed (`scrubEvent`): of the request only the method and the URL without its
  query string are kept (no body, so no answers or passwords; no headers, so no tokens); user and extra data are
  removed, and HTTP/console breadcrumbs are dropped.
- **D9.1** k6 could not be downloaded in this environment, so `run-load.mjs` (same scenarios as the k6 scripts) was
  used. The demo server runs on PGlite with one connection; that makes the database the bottleneck, which is
  pessimistic for latency and says nothing about Render's 0.1 CPU.
- **D9.2** Fixes from the load test: serving uses a stem-hash-only query (not every embedding), and at most
  `POOL_ON_DEMAND_CONCURRENCY` (2) on-demand generations run at once; the rest wait their turn.
- **D10.1** Quick-start PDFs are rendered with the app's own PDF renderer and fonts, so Urdu shapes correctly.

## Open issues

- YouTube transcripts cannot be fetched server-side today (D0.3). Live test fails by design until YouTube
  changes or an official route exists.
- Sindhi ~772 strings missing (quota); machine translations need native review.
- 512 MB Docker run not done (disk); load test not yet on Render/Neon; seed:demo not run end to end.
- glob/minimatch moderate advisories in dev tooling (overrides unsafe, reverted).
