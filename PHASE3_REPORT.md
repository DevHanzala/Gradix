# Phase 3 report

Branch `phase-3` (from `main` at `00deb75`), one commit or more per section, **not pushed**. Nothing was deployed,
no Render setting was changed and no account was created. Decisions are numbered D0.1–D10.x in
`PHASE3_PROGRESS.md`; evidence (screenshots, logs, scripts) is in `docs/phase3-evidence/`.

Status words: **Done** = built, tested and checked in a browser where it has a screen. **Partial** = works,
with a gap stated next to it. **Not done** = not built.

## Gate (final run)

| Command | Result |
|---|---|
| `npm run lint` | pass (ESLint backend + frontend, i18n check) |
| `npm run i18n:check` | pass: 1,353 keys, 136 files (sd marked partial) |
| `npm run build` | pass (built in 9 s) |
| `npm test` | 333 passed, 1 skipped (opt-in live YouTube test), 24 suites |
| `npm audit --omit=dev` | 5 moderate, 0 high: the glob/minimatch chain under node-pg-migrate and firestore's rimraf (see Known issues). follow-redirects (high) and fast-xml-parser were fixed with `npm audit fix` during final verification |

## Checklist

### 0. Leftovers and providers

| Item | Status | Where |
|---|---|---|
| Uncovered objectives block publishing unless confirmed; uneven coverage shown | Done | `services/assessment*`, publish dialog (D0.1) |
| Dependency upgrades / audit (firebase 13, uuid, file-type overrides) | Done | `package.json` overrides (D0.2a–c); 0 production vulnerabilities at the time; glob/minimatch advisories appeared later (Known issues) |
| YouTube transcripts | Partial | YouTube now refuses server-side caption downloads; clear 422 `TRANSCRIPT_BLOCKED` asking for a text file (D0.3); `tests/youtube.live.test.js` (opt-in) |
| Gemini first, Groq fallback, `GEMINI_API_KEYS` list | Done | `helper/llm*`, D0.4a–b |
| Email over HTTPS (Brevo / Resend), SMTP for development | Done | `helper/emailProviders.js`, `tests/email.test.js` (D0.5) |

### 1. File storage (R2)

| Item | Status | Where |
|---|---|---|
| Storage abstraction: local disk / Cloudflare R2, signed links | Done | `helper/storage.js`, `routes/fileRoutes.js`, `tests/storage.test.js` (D1.1–D1.4) |
| Original uploads kept, reports moved out of Postgres | Done | migration `1760000001000_file-storage`, `services/storage/migrateStorage.js` |
| R2 driver checked against an S3-compatible server | Done | S3Mock in Docker (put/list/get/presign with Urdu name/delete) |

### 2. Live classroom

| Item | Status | Where |
|---|---|---|
| Join by code / QR, guests, nickname rules | Done | `services/live/live.service.js`, `Pages/Live/JoinLive.jsx` (D2.4, D2.5) |
| Teacher- and student-paced, server timers, pause/resume, reveal | Done | D2.1–D2.3 |
| Teacher board, projector, remove participant, results + CSV | Done | `Pages/Instructor/Live/*` |
| Survives reload / dropped socket / server restart | Done | browser check `docs/phase3-evidence/live` (14/14, includes a backend restart) |

### 3. Engagement

| Item | Status | Where |
|---|---|---|
| Game mode (points, streaks, leaderboard, podium, sounds) | Done | D2.7, D3.4 |
| Quick polls (single / multiple / text, anonymous) | Done | `services/live/engagement.service.js` (D3.1) |
| Exit tickets | Done | D3.2 |
| Team race | Done | D3.3; browser check `docs/phase3-evidence/engagement` (9/9, Urdu RTL) |

### 4. Question types

| Item | Status | Where |
|---|---|---|
| Fill in the blank (several blanks, several accepted answers) | Done | `utils/grading.js`, `services/questions/validation.js` (D4.1) |
| Matching with partial credit | Done | same |
| Images on questions and MCQ options (WebP, alt text required) | Done | `services/questions/questionImages.js` (D4.2) |
| In exam, review, practice, live, bank editor, PDF and DOCX papers | Done | browser check `docs/phase3-evidence/types` (12/12, Urdu) |

### 5. Proctoring and exam controls

| Item | Status | Where |
|---|---|---|
| Off / log / warn / auto-submit after N events, with consent screen | Done | `services/examControls.js`, `components/exam/ProctoringGuard.jsx` (D5.2) |
| Integrity timeline for the instructor | Done | types browser check |
| Exam window and late-join limit (time zone aware) | Done | D5.1 |
| Extra time per student, option shuffling | Done | D5.3 |
| Camera / screen recording | Not done | out of scope by design (no camera proctoring) |

### 6. Polish, help and accessibility

| Item | Status | Where |
|---|---|---|
| Help menu, help center, onboarding tour per role | Done | `components/help/*`, `Pages/Help.jsx` |
| Terms, privacy, landing page with plans and contact | Done | `Pages/Legal.jsx`, `Pages/Home.jsx` |
| In-app feedback → Super Admin inbox | Done | migration `1500_feedback`, `tests/feedback.test.js` |
| PWA (manifest, static-only service worker, offline page) | Done | `frontend/public/*` |
| Low-bandwidth mode, dyslexia font, read aloud, keyboard answers | Done | `store/preferencesStore.js`, `components/exam/ReadAloud.jsx` |
| Sindhi interface | Partial | RTL + font done; ~772 strings still English (AI quota) |
| Screenshot + accessibility pass (360/768/1280 × en/ur/ar/sd) | Done | `docs/phase3-evidence/visual-check` |

### 7. Plans and usage limits

| Item | Status | Where |
|---|---|---|
| Free / Pro / Institution limits in one file | Done | `config/plans.js` |
| Metering and `PLAN_LIMIT_REACHED`; running exams never stopped | Done | `services/plans.service.js`, `tests/plans.test.js` |
| Super Admin assigns plans, sees usage; instructor usage card | Done | `components/plans/*` |
| Payments | Not done | no gateway by decision; plans are assigned by hand |

### 8. Production readiness (Render free tier)

| Item | Status | Where |
|---|---|---|
| Jobs in the API process, concurrency 1 | Done | `jobs/runner.js` |
| Memory: Gemini embeddings + OCR in production, lazy heavy libraries, one PDF at a time with headless shell | Done | measured below |
| Health check, request IDs, JSON logs, graceful shutdown, optional Sentry (scrubbed) | Done | `services/health.js`, `services/monitoring.js`, `tests/production.test.js` |
| Backup / restore | Done | `services/backup.js` (round trip tested) |
| "Waking up the server" banner with retries | Done | `components/WakeScreen.jsx` |
| render.yaml Blueprint, GitHub Actions CI, DEPLOYMENT.md | Done | repository root |
| 512 MB container test | Partial | script ready (`Dockerfile.memtest`), not run: Docker's disk filled up; measured on the host instead |

### 9. Load test

| Item | Status | Where |
|---|---|---|
| k6 scripts + equivalent Node runner | Done | `docs/phase3-evidence/loadtest` (k6 binary download was not allowed here; the Node runner was used) |
| 200 concurrent students + 200-participant live session | Done | results below |
| Bottlenecks found and fixed | Done | stem-hash-only query, on-demand concurrency limit |
| On Render's real CPU and Neon's pool | Not done | needs the deployment |

### 10. Pilot kit and FYP documents

| Item | Status | Where |
|---|---|---|
| Quick-start guides (EN/UR, Markdown + PDF, one page each) | Done | `docs/quickstart/` |
| USER_MANUAL, TRACEABILITY, DEMO_SCRIPT, README, DEPLOYMENT | Done | repository root |
| `npm run seed:demo` | Partial | written; not run end to end (needs real AI quota) |

## Measurements

**Memory** (`docs/phase3-evidence/memory/memory-local.md`; Node heap capped at 384 MB, real Chromium):

| Phase | Peak, Node + Chromium |
|---|---|
| Boot / idle | 93 MB |
| Pool generation (3 languages) | 105 MB |
| PDF report (Urdu) | 327 MB (401–452 MB with full Chrome before switching to headless shell) |
| DOCX / PDF papers | 125–127 MB |

**Load** (`docs/phase3-evidence/loadtest/results.md`; demo server on PGlite with **one** database connection, which is
pessimistic for the database and optimistic for CPU):

| Run | Requests | Failed | Finished | Timer drift p99 | Peak memory |
|---|---|---|---|---|---|
| 50 students | — | 0 | all | — | — |
| 200 students, autosave | 7,600 | 0 | 200/200 | 259 ms | 130 MB |
| 200-participant live session | 2,212 | 0 | 1,000/1,000 answers; socket push p95 110 ms, p99 128 ms | — | — |
| 400 students | 15,200 | 0 | 400/400 | 401 ms | 140 MB |

At 400 students latency grows (advance p95 12 s) because every query waits for the single connection. The first
200-student run crashed (V8 heap): each on-demand generation loaded every pool embedding and top-ups ran inside
requests. Both were fixed (commit `75c810b`).

**Browser checks** (Puppeteer against the real frontend build and a demo API with faked AI):

| Flow | Result |
|---|---|
| Live classroom, incl. backend restart (`live/`) | 14/14 |
| Polls, exit ticket, team race, podium in Urdu (`engagement/`) | 9/9 |
| New question types, papers, proctoring, window, extra time in Urdu (`types/`) | 12/12 |
| Every page × 3 widths × 4 languages, overflow/raw keys/dir/console/axe (`visual-check/`) | 336 captures: 0 axe serious/critical, 0 raw keys, 0 console errors, RTL right everywhere; 1 overflow (4 px, projector at 360 px) fixed and re-checked |

## New environment variables

Names only; placeholders are in `backend/.env.example` and `frontend/.env.example`, and each is explained in
DEPLOYMENT.md.

| Variable | Purpose |
|---|---|
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Which email provider and sender |
| `BREVO_API_KEY`, `RESEND_API_KEY` | HTTPS email providers (one is enough) |
| `GEMINI_API_KEYS` (and single `GEMINI_API_KEY`) | Comma-separated Gemini keys, rotated |
| `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR` | `local` or `r2`; local folder |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | Cloudflare R2 |
| `STORAGE_SIGNING_SECRET` | Signs local file links (defaults to `JWT_SECRET`) |
| `RUN_WORKER_IN_PROCESS` | Run background jobs inside the API (default true) |
| `EMBEDDING_PROVIDER`, `OCR_PROVIDER` | `local`/`gemini`; `gemini` in production to fit 512 MB |
| `SENTRY_DSN`, `VITE_SENTRY_DSN` | Optional error monitoring |
| `POOL_MIN_DISTINCT_SETS`, `POOL_ON_DEMAND_CONCURRENCY` | Pool size; on-demand generation limit |
| `DEMO_PASSWORD`, `DEMO_EMAIL_DOMAIN` | `npm run seed:demo` only |
| `YOUTUBE_LIVE_TEST`, `YOUTUBE_LIVE_VIDEO` | Opt-in live YouTube test |

No longer required: `GEMINI_CHECKING_API_KEY` (D0.4b).

## Migrations

`1760000001000_file-storage`, `1100_live-sessions`, `1200_live-engagement`, `1300_question-types`,
`1400_exam-controls`, `1500_feedback`, `1600_plans`, `1700_embedding-provider`. Each was run up, down and up again
on a throwaway database. **None was run against the real (Neon) database**: that is a deployment step for you.

## Known issues and limits

1. **YouTube** links cannot be read on a server today (D0.3). Instructors paste the transcript as a file.
2. **Sindhi** is partly translated (~772 strings fall back to English) because the free Gemini quota ran out. Finish
   with `node backend/scripts/translateUi.js sd` after the quota resets.
3. **Machine translations** in ur/ar/fa/sd for Phase 3 strings need a native speaker
   (`docs/translation-review-*.md`).
4. **glob / minimatch** moderate advisories (via node-pg-migrate, used only by `npm run migrate`, and firestore's rimraf, never imported): npm's only fix downgrades node-pg-migrate; forcing the fixed major versions under the tools that
   pin the old ones was unsafe, so the overrides were reverted and the advisories left as known.
5. **512 MB container test** was not run (Docker's disk filled up on this machine). Memory was measured on the host
   with the same limits; run `Dockerfile.memtest` on a machine with free disk to confirm.
6. **Load test** ran on PGlite with one connection, not on Render's 0.1 CPU and Neon. Repeat with the k6 scripts
   after deploying (DEPLOYMENT.md).
7. **`npm run seed:demo`** was written but not run end to end (needs real AI quota).
8. **firebase 13**: Google sign-in builds and the API is compatible, but it was not clicked through in a browser.
9. Plans have **no payment gateway**; the Super Admin assigns them.
