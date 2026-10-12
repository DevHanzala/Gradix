# Phase 1 Report — Gradix

Work is on branch **`phase-1`** in `backend_temp` and `frontend_temp`, one commit per section after a "baseline before phase 1" commit. Root docs are in a small root repo. Nothing was pushed.

> **Note:** this report was written under a usage limit. The 1G screenshot pass (360/768/1280 px) was **not run**; see §5.

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
| 4 | Renames | ✅ | `_temp` folder names left as-is |
| 5 | console.log removed | ✅ | |

### 1F Foundations — backend `767ac89`, root `0d5adce`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | Migrations | ✅ | `migrations/1760000000000_initial-schema.sql`, `npm run migrate`; idempotent; safe on existing DB |
| 2 | Seed | ✅ | `npm run seed` |
| 3 | Jest + Supertest | ✅ | 108 tests; in-process PGlite by default or real Postgres via `TEST_PG*` |
| 4 | Backend lint | ✅ | |
| 5 | Root README | ✅ | |

### 1G UI consistency — frontend `227fc05`
| # | Item | Status | Note |
|---|---|---|---|
| 1 | Tokens, kit, role layouts, one toast lib | ✅ | `App.css @theme`, `components/ui/*`, `layouts/AppShell.jsx` |
| 2 | All pages refactored | ✅ | Create/Edit share `AssessmentForm` |
| 3 | Responsive rules | 🟡 | Implemented (mobile-first, tables → cards, sheet modals, 44 px) but **not screenshot-verified** |
| 4 | Exam screen | ✅ | Sticky mobile nav, RTL via `dir` + logical classes |
| 5 | Loading / empty / error states, field errors | ✅ | |
| 6 | Accessibility basics | 🟡 | Labels, focus-visible, keyboard modals, skip link; contrast not measured |
| 7 | Verify at 360/768/1280 | ❌ | Not done (usage limit) |

**Counts: 49 Done · 2 Partially done · 1 Not done.**

## 2. Commands run and results
| Command | Result |
|---|---|
| `frontend: npm run lint` | 0 errors, 0 warnings |
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
| Admin cannot demote super admin; student cannot open instructor pages | **Pass** (API tests; UI guard by reasoning) |
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
- **Not verified visually:** the 1G responsive pass. Next step: run the app, then screenshot every page at 360/768/1280 (a demo-server script exists in my scratchpad, not in the repo).
- The exam timer UI and the drawer focus trap were reasoned about, not browser-tested.
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
