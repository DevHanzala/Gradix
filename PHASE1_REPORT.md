# Phase 1 Report — Gradix

Phase 1 was done on `phase-1` branches of the former `backend_temp` and `frontend_temp` repos, one commit per section. Those repos are now combined into the **gradix** monorepo (`backend/`, `frontend/`, root docs) with full history. Commit hashes below are the original ones; in the monorepo the same commits keep their messages but have new hashes (history was rewritten to remove secrets).

**Phase 1 is complete: every checklist item is Done.**

## 1. Checklist

Legend: ✅ Done · 🟡 Partially done · ❌ Not done

### 1A Critical security — backend `1514c57`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | google-auth verifies Firebase ID token | ✅ | `config/firebaseAdmin.js`, `services/auth.service.js`; identity only from token; rate limited; frontend sends `idToken` |
| 2 | No answers to client before submit | ✅ | `/start`, resume, autosave strip answers; submission details only for completed attempts; tested |
| 3 | Redis hardcoded fallbacks | ✅ | Removed; Redis then removed entirely in 1D |
| 4 | Delete `/api/logs` | ✅ | `app.js` |
| 5 | createSuperAdmin from env | ✅ | `SUPERADMIN_EMAIL/PASSWORD`, never printed, refuses without |
| 6 | Startup env validation | ✅ | `config/env.js` |
| 7 | `.env.example` (both apps) | ✅ | |

### 1B Exam integrity — backend `456d7d6`, frontend `318b6d2`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | One attempt + partial unique index | ✅ | `uq_attempts_one_online_per_student`; `ALREADY_ATTEMPTED` vs `IN_PROGRESS` |
| 2 | Dashboard status | ✅ | Per-assessment status from server; no "last 5" logic |
| 3 | Autosave endpoint + indicator | ✅ | `PUT /taking/attempts/:id/answers/:qid`; Saving/Saved/Offline |
| 4 | Resume | ✅ | `GET /taking/assessments/:id/attempt`; Start resumes |
| 5 | LLM failure leaves no attempt | ✅ | Questions generated before the attempt row; transactional insert |
| 6 | Timer fixes | ✅ | No ×60; per-question auto-advance; last question and overall timeout auto-submit |
| 7 | No Previous; server windows (2 s grace); submit validates | ✅ | `computeTiming` in `studentAssessment.service.js`; tested |
| 8 | `is_executed` after enrollment check | ✅ | |
| 9 | "Progress saved" text true | ✅ | |

### 1C Authorization — backend `16cacec`, frontend `6f17477`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | ProtectedRoute + 403 page | ✅ | `allowedRoles`; `/forbidden` |
| 2 | Ownership + execution lock | ✅ | `services/assessmentAccess.js` on update/delete/link/unlink/enroll/preview/print |
| 3 | Role-change rules + UI | ✅ | Checks the target's current role; shared `UserManagement` shows only allowed actions |
| 4 | change-password protected + email | ✅ | Separate public `/reset-password`; Profile form |
| 5 | `/resources/all` + link checks | ✅ | |
| 6 | 24 h tokens, no oracle | ✅ | Plus `/auth/resend-verification` |
| 7 | Rate limits + helmet | ✅ | `authLimiter`, per-user `aiLimiter` |
| 8 | Generic login / forgot messages | ✅ | |
| 9 | Escape email + PDF HTML | ✅ | `utils/escapeHtml.js` |

### 1D Broken flows — backend `b8806cb`, frontend `e7ac7ce`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | Tesseract v6 + scanned PDF | ✅ | Scanned PDFs rendered with `pdf-to-img`; fixtures in `tests/fixtures`; tested |
| 2 | Chunk merge, clear errors | ✅ | 422 with file name |
| 3 | Atomic upload/create/edit | ✅ | `helper/resourceIngest.js` (prepare, then transaction) |
| 4 | Edit sends `files` | ✅ | |
| 5 | Enrollment email; all emails after commit, non-fatal | ✅ | `helper/emailService.js` fire-and-forget |
| 6 | Unicode grading, one shared helper | ✅ | `utils/grading.js`; analytics use `is_correct` |
| 7 | MCQ canonicalisation | ✅ | |
| 8 | Gemini `config`; recommendations signature | ✅ | |
| 9 | Resource `url` / `file_type` | ✅ | |
| 10 | No fake print attempts; excluded from analytics | ✅ | |
| 11 | Redis cache | ✅ | Removed |
| 12 | Duplicate route / bad frontend call | ✅ | |
| 13 | PDF labels, answer key | ✅ | Verified visually with an Urdu paper |

### 1E Frontend crashes and hygiene — backend `5a26193`, frontend `5468b56`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | 4 runtime errors | ✅ | |
| 2 | Lint 0, no empty catch, hook deps | ✅ | |
| 3 | Dead code / deps; lazy jsPDF; no chunk > 500 kB | ✅ | Firebase also lazy-loaded |
| 4 | Renames | ✅ | `_temp` folders later became `backend/` and `frontend/` in the monorepo |
| 5 | console.log removed | ✅ | |

### 1F Foundations — backend `767ac89`, root `0d5adce`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | Migrations | ✅ | `migrations/1760000000000_initial-schema.sql`, `npm run migrate`; idempotent; safe on existing DB |
| 2 | Seed | ✅ | `npm run seed` |
| 3 | Jest + Supertest | ✅ | 108 tests; in-process PGlite by default or real Postgres via `TEST_PG*` |
| 4 | Backend lint | ✅ | |
| 5 | Root README | ✅ | |

### 1G UI consistency — frontend `227fc05`, verification fixes `ac77e4a`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | Tokens, kit, role layouts, one toast lib | ✅ | `App.css @theme`, `components/ui/*`, `layouts/AppShell.jsx` |
| 2 | All pages refactored | ✅ | Create/Edit share `AssessmentForm` |
| 3 | Responsive rules | ✅ | Mobile-first; tables → cards; full-screen modals on phones; 44 px targets; verified: no horizontal scroll on any page at 360/768/1280 |
| 4 | Exam screen | ✅ | Sticky mobile nav, RTL via `dir` + logical classes |
| 5 | Loading / empty / error states, field errors | ✅ | |
| 6 | Accessibility basics | ✅ | Every control labelled (checked automatically); visible focus; focus-trapped modals and drawer with Escape; skip link; all text/background token pairs meet WCAG AA (≥ 4.5:1, computed) |
| 7 | Verify at 360/768/1280 | ✅ | Puppeteer pass over 29 views × 3 widths (85 screenshots in `screenshots/`, git-ignored) |

**Counts: 52 Done · 0 Partially done · 0 Not done.**

### How 1G was verified
I ran a local demo backend (the real app against Docker Postgres, with fake LLM/email/CAPTCHA) seeded with:
- one user per role
- a completed attempt
- an in-progress Urdu exam

Puppeteer then opened every page at 360, 768 and 1280 px, including:
- auth pages, 404 and 403
- the student dashboard and results
- exam start, exam in progress in Urdu RTL, and exam result
- every instructor page, with the answer review and the print dialog opened
- admin and super admin
- the mobile drawer

It took full-page screenshots and automatically checked for horizontal overflow, touch targets under 44 px, unlabeled controls, images without alt text, and console errors. It found these issues, all now fixed:
- duplicate ids in responsive tables, which left role selects unlabeled on phones
- a 5 px overflow of the users table at 768 px
- bottom-sheet instead of full-screen modals on phones
- English badges mis-ordered inside the RTL exam
- 40 px avatar and 19 px auth links
- an unlabeled hidden file input
- a missing favicon
- one color pair below AA

The final run is clean. The only console entry left is the expected 400 from an invalid verification link. "Skip to content" is reported small only because it is visually hidden until focused.

## 2. Commands run and results
| Command | Result |
|---|---|
| `frontend: npm run lint` | 0 errors, 0 warnings |
| Puppeteer layout/a11y pass, 85 screenshots | Clean after fixes (see 1G) |
| `frontend: npm run build` | Passes; no chunk > 500 kB (main ~420 kB) |
| `backend: npm run lint` | Clean |
| `backend: npm test` | **108/108 pass** on PGlite (~23 s), and 108/108 on real Postgres 16 + pgvector (Docker) |
| `npm run migrate` on an empty Docker DB (pgvector/pgvector:pg16) | Applies; re-applying over the existing schema also works |
| `npm run seed` twice | Idempotent; weak passwords refused |

Smoke scripts for 1B/1C/1D also passed against Docker Postgres, and an Urdu RTL PDF was rendered and inspected.

### End-to-end flows (by test or manual reasoning)
| Flow | Result |
|---|---|
| Instructor: sign up, verify, create from prompt and from an uploaded file, enroll, edit before execution, locked after | **Pass** (tests; signup verification by test) |
| Student: start, answer, refresh and resume, auto-advance, submit, no restart, results and review | **Pass** (API tests; UI timer/resume logic by reasoning) |
| No correct answers in any response before submit | **Pass** (test) |
| Admin cannot demote super admin; student cannot open instructor pages | **Pass** (API tests; UI redirect to /forbidden seen in screenshots) |
| Urdu RTL paper | **Pass** (PDF rendered and inspected) |

## 3. Env variables to set and secrets to rotate
**New backend variables:**
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME` (optional)
- `SEED_PASSWORD`, `SEED_EMAIL_DOMAIN` (optional)
- `PGPORT`, `PGPOOL_MAX`, `TRUST_PROXY`, `PUPPETEER_EXECUTABLE_PATH` (optional)

**Removed:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

**Rotate ALL secrets.** Both repos have `.env` committed in earlier history (`980dbe5` backend, `26aebce` frontend), and they have GitHub remotes. Assume these are exposed:
- DB password
- `JWT_SECRET`
- Gmail app password
- Gemini and Groq keys
- reCAPTCHA secret
- Upstash token (also hardcoded in `DB/redis.js` history)
- the default super-admin password `***REMOVED***`

Rewriting git history is your call (it needs a force-push).

## 4. Decisions I made on your behalf
- **Git setup.** Worked on a new `phase-1` branch in the two existing repos instead of nesting them in a new root repo.
- **Migration on an existing DB.** It is idempotent. Historical retakes are flagged `superseded = true` (keep the first attempt); nothing is deleted.
- **Exam rules.**
  - Questions are generated before the attempt row exists, so a failed generation leaves nothing behind (instead of a "failed" status).
  - Timing uses the app server's clock.
  - Late answers sent offline are rejected once their window closes.
- **Locks and access.**
  - Delete is also locked after execution.
  - Enroll/unenroll stay allowed after execution.
  - Super admin may access any assessment.
- **Emails are case-insensitive.** Login, lookups and an index use `LOWER(email)`, because legacy accounts have mixed case.
- **Removed outright.**
  - Redis.
  - The "copy identical AI prompt" tab: its claim was false.
  - Unused dependencies.
- **Small UI additions for existing backend capabilities:** file upload in the Create form, a "share publicly" option on resource upload, and resend-verification.
- **Licensing.** Chose MIT `pdf-to-img` over AGPL `mupdf`.

## 5. Known remaining issues and Phase 2 items
- **Manual check still worth doing:** a real phone with real Google sign-in, reCAPTCHA and Gemini. Automated runs used fakes for these external services.
- **Exam UI:** the server-side timing is covered by tests and was seen auto-advancing during the screenshot run. The client timer was not tested click-by-click in a browser.
- **Phase 2 (deliberately not built):**
  - adaptive difficulty
  - learning objectives / fairness
  - RAG retrieval (embeddings stored but unused; 500-word chunks exceed MiniLM's ~256-token limit)
  - app-wide i18n, and reports in the student's language
  - groups and admin scoping (admins currently see all users)
  - DOCX export
  - link/YouTube ingestion
  - de-dup / search in the resource library
  - per-question cross-student analytics
  - deletion emails and a notifications table
  - live scoring
  - Persian OCR data (`fas.traineddata` missing)
- The downloadable report is English-only (jsPDF's Latin font).
- Old analytics endpoints (overview/performance/recommendations) remain but are unused by the UI.

## 6. Updated completion (as strict as AUDIT.md)
| Feature | Before | Now | Why |
|---|---|---|---|
| F1 Unique AI questions | 55% | 65% | Ingestion and OCR work, canonical MCQ; still no objectives or RAG |
| F2 Adaptive | 5% | 15% | Per-answer `answered_at` and server timing; nothing adaptive |
| F3 Multilingual + RTL | 55% | 60% | Unicode grading fixed; UI still English |
| F4 Print | 80% | 85% | Labels, answer key, escaping; no DOCX |
| F5 Negative marking | 80% | 90% | Correct everywhere incl. non-Latin; no live score |
| F6 Learning pathways | 40% | 60% | Immediate results, review, real report; recommendations not in UI or in the student's language |
| F7 Roles | 50% | 65% | Correct RBAC, UI guards; no groups |
| F8 Minimal creation | 65% | 90% | Validation, atomic, real lock |
| F9 Security & session | 45% | 85% | One attempt, server timers, verified Google, rate limits |
| F10 Resource library | 30% | 45% | Visibility and sharing; no de-dup/search |
| F11 Analytics | 45% | 50% | Correct counts; no cross-student analytics |
| **Overall** | **≈50%** | **≈65%** | |
