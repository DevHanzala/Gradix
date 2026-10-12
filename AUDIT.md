# Gradix (Gradewise-AI) — Codebase Audit

**Audit date:** 2026-10-12
> Paths in this document were updated to the monorepo layout (`backend/`, `frontend/`). At audit time the folders were `backend_temp/` and `frontend_temp/`.

**Scope:** `backend/` (Node/Express API) and `frontend/` (React/Vite SPA), every source file read.
**Method:** Static reading of all source files, plus the scripts that already exist (`eslint`, `vite build`, `npm test`). Nothing was installed, fixed, or modified. The only file created is this one. The backend server was **not** started because it connects to live cloud services (Neon Postgres, Upstash Redis, Gmail, Gemini/Groq). Secret values in `.env` files were **not** read; only the variable names were listed.

**Status legend**

| Status | Meaning |
|---|---|
| DONE | A user can do it end-to-end (UI + API + DB) and the logic looks correct |
| PARTIAL | Some layers exist, or it is stubbed, hardcoded, or incomplete |
| BROKEN | Code exists but has a clear bug, will crash, or doesn't do what's required |
| MISSING | No code found |
| UNCLEAR | Can't be determined from the repo; the reason is given |

> Line numbers refer to the files as they are on disk at audit time.

---

## 1. Executive summary

**Overall completion: about 50%** (unweighted average of F1–F11; see §5). If you weight the headline differentiators (adaptive difficulty, per-student fairness, multilingual UI, learning pathways), it drops to about **40%**. The happy path mostly works: an instructor creates an assessment from a prompt or an uploaded document and enrolls students. A student then picks a language and gets an LLM-generated MCQ/True-False set with negative marking, and the instructor can print a translated RTL PDF. But the platform is **not demo-safe or integrity-safe yet**:

- `POST /api/auth/google-auth` issues a JWT for **any email the caller types**, which allows full account takeover, including Super Admin.
- The exam start API **sends every correct answer to the browser**.
- "One attempt per student" is **not enforced** once an attempt completes.
- A page refresh during an exam **locks the student out permanently**.
- The overall exam timer is **60× too long**.
- Adaptive difficulty (F2) is **entirely missing**.
- Learning objectives / fairness mapping, groups (F7.4), notifications, de-duplication, and DOC export are **missing**.
- The UI is English-only apart from the print dialog.
- The "downloadable report" PDF contains **only the assessment title**.
- There are **no tests**, **no DB migrations** (only the `users` table can be recreated from the repo), and lint reports **24 errors**. Several of those errors are real runtime crashes: failed login shows no message, the enrolled-students list never loads, and the error boundary itself crashes.

**Verdict:** a working prototype of the core "AI-generated, per-student, multilingual MCQ exam" idea, with serious security and exam-integrity holes. Fix those before any demo where someone might open DevTools.

---

## 2. Tech stack: actual vs. planned (SRS)

### 2.1 Project map

```
Gradewise-AI/                      (NOT a git repository; .gitignore files are inert)
├── backend/                  Node 22, Express 4, ESM ("type": "module")
│   ├── index.js                   entry point: mounts routes, /api/health, /api/logs
│   ├── DB/db.js, DB/redis.js      pg Pool (Neon), Upstash Redis client
│   ├── routes/ → controllers/ → services/ → models/ → repositories/   (layered)
│   ├── validator/                 hand-written validators + reCAPTCHA middleware
│   ├── helper/                    text extraction/OCR, embeddings, email, Puppeteer PDF
│   ├── services/ai/               Gemini + Groq provider selection, generateContent
│   ├── scripts/createSuperAdmin.js  only DDL in repo (users table) + seeds super admin
│   ├── assets/tessdata/           OCR language packs: eng, ara, urd, hin
│   └── fonts/NotoSansArabic-Regular.ttf
└── frontend/                 React 19 + Vite 7 + Tailwind 4 + Zustand + react-router 7
    └── src/
        ├── main.jsx, App.jsx      entry + all routes
        ├── api/                   axios wrappers per domain
        ├── store/                 Zustand stores (auth persisted to localStorage)
        ├── Pages/{Admin,SuperAdmin,Instructor,Student}/...
        ├── components/            modals, print dialog, preview tabs
        └── utils/                 translations.js (print dialog only), dead pdf/docx generators
```

Entry points: `backend/index.js` (`npm start` / `npm run dev`) and `frontend/src/main.jsx` (`npm run dev` / `npm run build`).

### 2.2 Stack comparison

| SRS planned | Actual | Notes |
|---|---|---|
| React frontend | ✅ React 19 + Vite 7, Tailwind 4, Zustand, react-hook-form/zod | |
| REST API | ✅ Express 4 REST under `/api/*` | |
| JWT | ✅ `jsonwebtoken`, HS256, 24h, stored in `localStorage` | No refresh tokens or revocation list (role is re-read from DB on each request, which is good) |
| RBAC | ⚠️ Backend `authorizeRoles()` middleware on most routes; **frontend role guard non-functional** (see BUG-9) | |
| LLM API | ✅ Google Gemini `gemini-2.5-flash` (`@google/genai`) + Groq `openai/gpt-oss-20b`, random primary/fallback (`services/ai/generateContent.js`) | `openai` npm package installed but unused |
| Vector DB | ⚠️ **pgvector inside Postgres** (`resource_chunks.embedding::vector`, 384-dim) | Embeddings are stored but **never queried**. There is no similarity search anywhere. |
| Embeddings | Local `@xenova/transformers` `all-MiniLM-L6-v2` (384-dim, runs in the Node process) | |
| Relational DB | ✅ PostgreSQL (Neon, SSL) via `pg` | **No schema/migrations in repo** except `users` |
| DOC/PDF export | ⚠️ PDF only, server-side Puppeteer (`helper/Pdfkitgenerator.js`; despite the name it does not use pdfkit) | DOCX generator exists in the frontend but is **dead code** |
| CAPTCHA | ⚠️ Google reCAPTCHA **v3** (score ≥ 0.5), server-verified, on signup and login only | |
| Email service | ✅ Nodemailer + **Gmail SMTP** (`EMAIL_USER`/`EMAIL_PASS`) | `RESEND_API_KEY` is in `.env` but unused |
| i18n library | ❌ None. A hand-rolled `utils/translations.js` is used **only by the print dialog** | |
| (extra) | Firebase Auth (Google sign-in), Upstash Redis (one cache), Tesseract.js OCR, office-text-extractor, pdf-parse, Puppeteer | |

### 2.3 Database: inferred schema vs. SRS entities

There is no migration or schema file. The table list below is inferred from SQL in the repositories. Column types (notably `generated_questions.correct_answer`: JSONB vs TEXT) are **UNCLEAR**, and that matters for grading (see F1.5).

| SRS entity | Found | Evidence |
|---|---|---|
| User | ✅ `users` | `scripts/createSuperAdmin.js:27-41` (only DDL in repo) |
| Group | ❌ MISSING | no table, model, or route |
| GroupMembership | ❌ MISSING | — |
| Resource | ✅ `resources` | `repositories/resourceRepository.js` (but `url`/`file_type` never inserted, see F10) |
| EmbeddingChunk | ✅ `resource_chunks` (pgvector) | `repositories/assessmentRepository.js:320-338` |
| Assessment | ✅ `assessments`, `question_blocks`, `assessment_resources`, `enrollments` | `repositories/assessmentRepository.js` |
| Question | ✅ `generated_questions` (per attempt) | `assessmentRepository.js:380-415` |
| AttemptSession | ✅ `assessment_attempts` | `services/studentAssessment.service.js:81-85` |
| Result | ⚠️ folded into `assessment_attempts.score` + `student_answers` | no separate Result entity |
| LearningPathwayReport | ❌ MISSING (generated on the fly, never persisted) | `services/studentAnalytics.service.js:96-157` |
| Notification | ❌ MISSING | no table; only fire-and-forget emails |

Other inferred columns: `assessment_attempts(language, status, started_at, completed_at, score, attempt_number, is_physical_paper)` and `student_answers(attempt_id, question_id, student_answer, score, is_correct?)`. `services/studentAnalytics.service.js:176-185` also queries `assessment_attempts.percentage` and `submitted_at`, which nothing ever writes (that handler is unreachable anyway).

### 2.4 Environment variables

The `.env` files exist in both app folders. Only the variable names were read.

| App | Variables (from `.env` and code) | Required by code? |
|---|---|---|
| backend | `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` (`PGSSLMODE`, `PGCHANNELBINDING` present but unused; `DB/db.js` hardcodes port 5432 and SSL) | yes |
| | `PORT`, `FRONTEND_URL` (CORS origin + email links), `NODE_ENV` | yes |
| | `JWT_SECRET` | yes, **not validated at startup** (`index.js:53-68` checks only Gemini keys) |
| | `EMAIL_USER`, `EMAIL_PASS` (Gmail) | yes |
| | `GEMINI_CREATION_API_KEY_1` (required), `GEMINI_CREATION_API_KEY_2`, `GROQ_API_KEY` (optional), `GEMINI_CHECKING_API_KEY` (required) | yes |
| | `RECAPTCHA_SECRET_KEY` | yes |
| | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (**fallback values hardcoded**) | yes |
| | `RESEND_API_KEY` | present, unused |
| | `PUPPETEER_EXECUTABLE_PATH` | optional, read in `helper/Pdfkitgenerator.js:36` |
| frontend | `VITE_API_URL`, `VITE_FIREBASE_*` (6 keys), `VITE_RECAPTCHA_SITE_KEY`, `VITE_NODE_ENV` | yes |

External services the code expects to be configured: **Neon Postgres with the pgvector extension and pre-created tables**, Upstash Redis, Gmail SMTP app password, Gemini (2 projects), optionally Groq, Google reCAPTCHA v3, Firebase project with Google provider, and a Chromium binary for Puppeteer.

---

## 3. Build / lint / test results

| Check | Command (existing script) | Result |
|---|---|---|
| Deps installed? | — | ✅ `node_modules` present in both apps |
| Frontend lint | `npm run lint` (`eslint .`) | ❌ **32 problems: 24 errors, 8 warnings** |
| Frontend build | `vite build` (output redirected to a temp dir, repo untouched) | ✅ Builds. ⚠️ Two chunks > 500 kB (`index` 577 kB, `useStudentAnalyticsStore` 592 kB because jsPDF+html2canvas are bundled eagerly) |
| Backend tests | `npm test` | ❌ Placeholder: `echo "Error: no test specified" && exit 1`. **No tests exist anywhere.** |
| Backend lint/typecheck | — | No script exists. `node --check` on every backend file found **no syntax errors**. |
| Backend run | `npm start` | **Not run.** It would connect to live cloud DB/Redis. Not verified at runtime. |

### Lint errors that are real runtime bugs (not just style)

| File:line | Error | Runtime effect |
|---|---|---|
| `frontend/src/Pages/Login.jsx:59` | `'ZodError' is not defined` | Any failed login (wrong password, unverified email) throws `ReferenceError` inside `catch`, so **the user never sees an error message** |
| `frontend/src/Pages/Instructor/AssessmentManagement/EnrollStudents.jsx:16,22` | `'setIsLoading' is not defined` | Throws before the fetch, so **the enrolled-students list never loads** |
| `frontend/src/components/ErrorBoundary.jsx:79` | `'process' is not defined` | `process` does not exist in Vite browser builds, so **the error boundary crashes while rendering its fallback** (white screen) |
| `frontend/src/store/useStudentAnalyticsStore.js:118` | `'toast' is not defined` | Report-download failure path throws an unhandled `ReferenceError` |

The remaining errors are unused variables and empty `catch {}` blocks. The empty catches in `useStudentAnalyticsStore.js:48,59,70,81` silently swallow every analytics API failure. The warnings are missing hook dependencies (8).

---

## 4. Requirement table

### F1: Unique AI questions per student

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 1.1 | Accept PDF / DOC / link / YouTube / text prompt | **PARTIAL** | `middleware/uploadMiddleware.js`, `helper/textProcessor.js:34-104`, `Pages/Instructor/AssessmentManagement/ResourceManagement.jsx:182`, `CreateAssessment.jsx:25-29` | PDF/DOC(X)/PPT(X)/TXT uploads work via Resource Management (create page only lets you *select existing* resources). Text prompt works. **Links are stored as strings and pasted into the LLM prompt; their content is never fetched** (`models/assessmentModel.js:302`). **No YouTube/transcript code at all.** OCR for images and scanned PDFs is **broken** (BUG-8). The resource-library URL path discards the URL (`repositories/resourceRepository.js:5-16` never inserts `url`). |
| 1.2 | Chunk + embed + store in vector DB | **PARTIAL** | `helper/textProcessor.js:119-128`, `helper/embeddingGenerator.js`, `repositories/assessmentRepository.js:320-338` | Chunks of 500 words, MiniLM-384 embeddings, stored in pgvector. But: (a) **embeddings are never used**. Generation concatenates all chunks and truncates to 5,000 chars (`assessmentModel.js:286-291`), so a long book only ever uses its first ~2 pages. (b) `generateEmbedding` throws when a chunk is < 120 chars (`embeddingGenerator.js:25-27`); the final chunk is often that short, so uploads fail (BUG-8). |
| 1.3 | Each student gets a different question set | **PARTIAL** | `services/studentAssessment.service.js:89`, `models/assessmentModel.js:263-409` | Each attempt makes a fresh LLM call, so sets differ **by sampling randomness only**. Nothing guarantees uniqueness or checks for overlap. `temperature` is silently ignored for Gemini because it is passed as `generationConfig` instead of `config` (`services/ai/generateContent.js:16-20`). |
| 1.4 | All sets map to the same learning objectives | **MISSING** | — | No objective extraction, tagging, or blueprint. Only the type/count per block is shared. |
| 1.5 | MCQ supported, extensible to other types | **DONE** (MCQ, T/F) | `CreateAssessment.jsx` type select, `scheema/assessmentSchemas.js:15`, `studentAssessment.service.js:149-155` | MCQ and True/False work end-to-end. Short-answer exists in the backend and exam UI but not in the create UI. Its grading is **broken**: `JSON.parse` on a plain-string answer throws, making the whole submit return 500 (`studentAssessment.service.js:141-147`), and a non-object rule gives `required=[]`, so any answer counts as correct. **UNCLEAR:** MCQ grading compares `JSON.stringify`-ed `correct_answer`. It works only if the column is JSON/JSONB, which can't be confirmed (no schema in repo). If the LLM answers `"B"` instead of `"B. text"`, the remap at `assessmentModel.js:377-385` is a no-op for array options and the answer is marked wrong. |
| 1.6 | Optional instructor prompt | **DONE** | `CreateAssessment.jsx:234-247`, `assessmentModel.js:301` | |

### F2: Adaptive difficulty

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 2.1 | Track correctness + response time | **PARTIAL** | `studentAssessment.service.js:134-194` | Correctness is computed only at final submit. **No per-question response time is recorded** anywhere (only attempt start/end). |
| 2.2 | Correct → harder next question | **MISSING** | — | The whole set is generated up front at start. No difficulty field exists. |
| 2.3 | Wrong/slow → easier | **MISSING** | — | |
| 2.4 | Final score accounts for difficulty progression | **MISSING** | — | Score = Σ(+pos / −neg), clamped at 0. |
| 2.5 | Rolling performance window | **MISSING** | — | |

### F3: Multilingual + RTL

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 3.1 | Language selection for instructor and student | **PARTIAL** | `TakeAssessment.jsx:161-170`, `components/PhysicalPaperModal.jsx` | Student picks en/ur/ar/fa at exam start. Instructor can only pick a language inside the print dialog. No app-wide language setting or user preference. |
| 3.2 | All UI text (timers, stats, reports) switches language | **MISSING** | `utils/translations.js` is imported only by the print-dialog components | Exam screen, dashboards, analytics, and reports are hardcoded English. |
| 3.3 | Automatic RTL for ar/ur/fa | **PARTIAL** | `TakeAssessment.jsx:43,141`, `helper/Pdfkitgenerator.js:114-129` | `dir="rtl"` on the exam page and the printed PDF only. The rest of the app has none. |
| 3.4 | Questions generated natively (not translated) | **DONE** | `models/assessmentModel.js:295-326` | The prompt instructs generation directly in the target language. Compliance depends on the LLM. Downstream analytics break for non-Latin answers (see F11). |
| 3.5 | Islamic/Arabic religious texts as source | **PARTIAL** | `helper/textProcessor.js` | Nothing specific is implemented. Arabic PDFs go through `pdf-parse`; when that yields < 300 chars, the OCR fallback is used, and it is broken. The "quality filter" (≥ 80 words, unique-word ratio ≥ 0.3, `textProcessor.js:97-101`) can reject short or repetitive texts, e.g. litanies or short surahs. |
| 3.6 | Students in one assessment choose different languages | **DONE** | `studentAssessment.service.js:81-85` stores `language` per attempt | |

### F4: Print generation

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 4.1 | Printable version in a selected language | **DONE** | `routes/assessmentRoutes.js:56`, `services/assessment.service.js:285-375`, `PhysicalPaperModal.jsx` | Generates a **fresh** question set in the chosen language, plus an answer key page. Each print makes a paid LLM call with no rate limit. |
| 4.2 | Full layout conversion incl. RTL | **DONE** | `helper/Pdfkitgenerator.js:114-129,178,209,257` | Uses the Noto Sans Arabic font. Minor bug: options already contain `"A. …"` and the template prepends the letter again, giving **"A. A. text"** (`Pdfkitgenerator.js:68`). The answer key shows `?` whenever `correct_answer` doesn't string-match an option (`:84-88`). |
| 4.3 | Custom header: date, time, instructor, institute, instructions | **DONE** | `PaperFormFields.jsx`, `assessment.service.js:285-375` | For non-English papers the header values (names, institute) are **sent through the LLM to be "translated"**, which can mangle proper nouns (`assessment.service.js:335-369`). |
| 4.4 | Export DOC and PDF | **PARTIAL** | PDF: `Pdfkitgenerator.js`. DOC: `frontend/src/utils/docxGenerator.js` | **PDF only.** The DOCX generator (and a client-side `pdfGenerator.js`) are imported nowhere, so they are dead code. The modal always saves `.pdf`. |

### F5: Negative marking

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 5.1 | Enable/disable per assessment | **PARTIAL** | `CreateAssessment.jsx` block fields | No explicit toggle. Setting negative marks to 0 per block disables it implicitly. |
| 5.2 | Configurable points for correct / deduction for wrong | **DONE** | `question_blocks.positive_marks/negative_marks`; `studentAssessment.service.js:158-162` | Minor: `Number(block.positive_marks \|\| 1)` (`CreateAssessment.jsx:164`) turns a deliberate 0 into 1. |
| 5.3 | Unanswered = 0 | **DONE** | `studentAssessment.service.js:158-162` | The total is also clamped at ≥ 0 (`:194`). That is not in the SRS; confirm it's intended. |
| 5.4 | Reflected in live scoring and final report | **PARTIAL** | `studentAnalyticsRepository.js:148-186` | **No live scoring.** Final score is correct. "Negative marks applied" in reports is recomputed with a `[^a-zA-Z0-9]` regex, so it is **wrong for Urdu/Arabic/Persian answers** (both sides become empty strings and count as "correct"). |

### F6: Learning pathways

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 6.1 | Immediate stats after submission (accuracy, time) | **PARTIAL** | `TakeAssessment.jsx` success modal; `Pages/Student/StudentAnalytics.jsx` | The submit API returns score and per-answer correctness, but the exam page only shows "Submitted!" and redirects. Stats appear only if the student opens Analytics and selects the assessment. |
| 6.2 | Review every question with correct/incorrect highlighted | **DONE** (MCQ/TF) | `StudentAnalytics.jsx:330-360`, `models/studentAnalyticsModel.js:235-280` | `is_correct` is **recomputed** with different logic than grading. For short answers it compares against the first keyword only, so it can disagree with the stored score. |
| 6.3 | AI weak-area identification | **PARTIAL** | `services/studentAnalytics.service.js:212-299`, `models/studentAnalyticsModel.js:172-233` | Per-assessment: weak question texts go to Gemini (works, falls back to static text on failure). General report: `generateContent(client, prompt, …)` is called with the **wrong signature** (`studentAnalyticsModel.js:192`), so the prompt becomes `"[object Object]"` and it always falls back. "Weak areas" are grouped by **question type**, not topic. |
| 6.4 | Personalized recommendations with resources | **PARTIAL** (backend only) | `studentAnalytics.service.js:212-299` | The AI study-plan JSON is returned by `/student-analytics/report`, but **no UI renders it**, and it never links resources. `/recommendations` is a hardcoded empty stub (`studentAnalytics.service.js:40-50`). |
| 6.5 | Downloadable report (stats, gaps, study plan, practice) | **BROKEN** | `frontend/src/store/useStudentAnalyticsStore.js:100-122` | Fetches the full report, then renders **only `<h1>{assessment_title}</h1>`** into the PDF, stretched to A4. Stats, gaps, and study plan are discarded. The failure path throws (`toast` undefined). A backend CSV export exists but no UI uses it. |
| 6.6 | Report in student's selected language | **MISSING** | — | The AI prompt has no language parameter. The UI is English. |

### F7: Roles (Super Admin / Admin / Instructor / Student)

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 7.1 | Exactly 4 roles with distinct permissions | **PARTIAL** | `validator/user.validator.js:1` | 4 roles exist. Admin and Super Admin are nearly identical except for delete. Admin/SA can hit instructor routes but see only assessments they created. |
| 7.2 | Super Admin views all users, elevates roles | **PARTIAL** | `routes/authRoutes.js:34-35`, `Pages/SuperAdmin/SuperAdminDashboard.jsx:343-370` | API supports any role. **UI only offers Student→Admin and Admin→Student.** There is no way to make an Instructor from the SA UI. |
| 7.3 | Super Admin deletes accounts + email notification | **PARTIAL** | `routes/authRoutes.js:36`, `services/auth.service.js:281-289` | Delete works (FK cascade behaviour UNCLEAR, no schema). **No email is sent.** UI shows Delete only on admin rows. |
| 7.4 | Admin manages only their own group, promote/demote within it | **MISSING / BROKEN** | `services/auth.service.js:246-278`, `validator/user.validator.js:30-52` | No groups exist. Admins see **all** users and can change **anyone's** role. Only the *target* role is checked, so **an Admin can demote the Super Admin or other Admins to student** (security). The Admin UI offers "→ admin" buttons that the backend then rejects. |
| 7.5 | Instructor: create, enroll/unenroll, analytics for own only | **PARTIAL** | `assessment.service.js`, `EnrollStudents.jsx`, `AddStudent.jsx` | Create/enroll/unenroll and analytics are owner-scoped. **But `PUT /api/assessments/:id` has no ownership check** (BUG-5). The enrolled-students list never loads (lint bug). The enrollment email is called with the wrong arguments (`assessment.service.js:234` vs `helper/emailService.js:66`): the student gets "Hi {title}… enrolled in {id}… Due: Invalid Date", and if Gmail fails the API returns 500 *after* the enrollment row was inserted. |
| 7.6 | Student sees only own assessments/results/pathway | **DONE** | all student queries filter by `req.user.id` | Cross-student access not found (see §7). Own correct answers leak during the exam (BUG-2). |
| 7.7 | Email on role change / critical account change | **PARTIAL** | `auth.service.js:265-275` | Role change: yes. Deletion, password change, email change: no. |
| — | **RBAC enforced on backend?** | **Mostly yes** | `middleware/authMiddleware.js` | Backend uses `protect` plus `authorizeRoles` or a service-level role check on almost every route. Gaps: `/api/logs` is public; PUT assessment lacks ownership; admin role-change scope. **The frontend role guard does nothing**: `App.jsx` passes `requiredRole=`, but `components/ProtectedRoutes.jsx:12,27` reads `allowedRoles`. Any logged-in user can open any dashboard page; the backend still returns 403 for the data. |

### F8: Minimal-input creation

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 8.1 | Only title + (resource OR prompt) required | **DONE** (UI-enforced) | `scheema/assessmentSchemas.js:25-35` | The backend create path (`assessment.service.js:26-44`) validates **only title**. The proper validation lives in `createNewAssessmentService`, which has no route (dead code). |
| 8.2 | Optional targeted prompt | **DONE** | same as 1.6 | |
| 8.3 | Marking scheme + per-question time limit (min 30 s) | **PARTIAL** | UI `min=30` + zod; backend `validator/assessment.validator.js:48` | The backend accepts any non-negative duration. 0 or 5 seconds can be sent directly to the API. |
| 8.4 | Processing/embedding/generation fully automatic | **PARTIAL** | upload pipeline; `studentAssessment.service.js:89` | Automatic, but: OCR broken; embeddings unused; generation happens **synchronously when each student clicks Start** (multi-second LLM wait), and a failure leaves a stuck `in_progress` attempt (BUG-6). |
| 8.5 | Editable before execution, locked after | **BROKEN** | `EditAssessment.jsx:290-432` (disabled inputs) vs `assessment.service.js:134-192` | The lock is **UI-only**. The backend PUT never checks `is_executed` (or ownership). Editing with new files **always fails**: the frontend sends field `new_files` (`EditAssessment.jsx:214`) but multer expects `files` (`routes/assessmentRoutes.js:40`), causing "Unexpected field". `is_executed` is set when *any* student, even an unenrolled one, calls Start, because the flag is set **before** the enrollment check (`studentAssessment.service.js:47-67`). |

### F9: Security & session

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 9.1 | One attempt per student per assessment (server-side?) | **BROKEN** | `studentAssessment.service.js:69-78` | The server only blocks while an attempt is `in_progress`. **After completing, the student can start again** (new questions, new score; analytics show the latest). The dashboard shows "Start" for any completed assessment older than the 5 most recent (`studentAnalyticsModel.js:52` + `StudentDashborad.jsx` `getAssessmentStatus`). |
| 9.2 | Per-question timer with auto-advance | **PARTIAL** | `TakeAssessment.jsx:91-112` | **Client-only.** The server never validates elapsed time or per-question timing. Students can press **Previous** to revisit questions, which defeats the per-question limit. The last question does not auto-submit. The overall timer is 60× too long (BUG-7). |
| 9.3 | CAPTCHA on auth forms | **PARTIAL** | `routes/authRoutes.js:20-21`, `validator/verifyCaptcha.js` | reCAPTCHA v3 on signup and login, server-verified. Not on forgot-password or google-auth. |
| 9.4 | JWT auth | **DONE** | `authMiddleware.js`, `auth.service.js` | 24h, localStorage, no refresh/revocation. The role is re-read from DB per request, which is good. |
| 9.5 | Email verification before access | **BROKEN** | `auth.service.js:102` vs `:59-85` | Manual login blocks unverified users, but **`/google-auth` returns a token for any email without verification** (BUG-1). `verifyEmailService` returns success `"already_used"` for **any invalid token** if anyone verified in the last hour (`auth.service.js:151-158`). Tokens never expire (the email says 24h). |
| 9.6 | Notifications on password / role / email change | **PARTIAL** | `auth.service.js:265-275` | Role change only. No password-change email. There is no email-change feature. **In-app password change is impossible**: `/change-password` is mounted before `protect` (`routes/authRoutes.js:28` vs `:31`), so `req.user` is always undefined, and the Profile page just redirects to "forgot password" (`Profile.jsx:81-85`). |

### F10: Resource library

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 10 | Shared reuse, de-duplication, search/select existing | **PARTIAL** | `routes/resourceRoutes.js`, `ResourceManagement.jsx`, `CreateAssessment.jsx:249-280` | Select-existing works (create page lists `/resources/all`). **No de-dup** (no hash or similarity check). **No search.** No visibility toggle in UI. `/resources/all` returns **every instructor's file resources including `private` ones** (`resourceRepository.js:43-54`), and any instructor can link someone else's private resource (`resource.service.js` link does no ownership/visibility check). URL resources lose their URL. |

### F11: Analytics

| ID | Requirement | Status | Evidence | Notes / bug |
|---|---|---|---|---|
| 11a | Instructor dashboard metrics | **PARTIAL** | `services/instructorAssessmentAnalytics.service.js:55-75` | Counts only: assessments, executed, resources. |
| 11b | Per-question analytics across students | **MISSING** | — | Not implemented. With per-student questions and no objective mapping, there is nothing to aggregate on. Per-student drill-down exists (`/instructor-analytics/assessment/:id/student/:studentId/questions`). |
| 11c | Per-student results for an assessment | **PARTIAL** | `repositories/instructorAnalyticsRepository.js:28-80` | Works. "Correct answers" uses a `[^a-zA-Z0-9]` regex (`:65`, and `models/InstructorAssessmentAnalyticsModel.js:143`), so it is **wrong for non-Latin answers**. Multiple attempts per student are summed together. Print-preview attempts created via `/api/taking/assessments/:id/print` are stored as *completed attempts with the instructor as `student_id`* (`studentAssessment.service.js:272-278`) and pollute analytics. |
| 11d | Super Admin stats | **PARTIAL** | `SuperAdminDashboard.jsx:100-113` | User counts by role, computed client-side from the full user list. No platform stats (assessments, attempts, AI usage). |

---

## 5. Per-feature completion

Scoring: DONE = 100, PARTIAL = 25–75 by judgment, BROKEN = 25, MISSING = 0, averaged per feature.

| Feature | Completion | One-line reason |
|---|---|---|
| F1 Unique AI questions | **55%** | Generation works; no fairness/objectives, embeddings unused, links/YouTube not ingested, OCR broken |
| F2 Adaptive difficulty | **5%** | Nothing adaptive; only end-of-exam correctness |
| F3 Multilingual + RTL | **55%** | Native generation + per-student language work; UI is English-only, RTL only on exam/print |
| F4 Print generation | **80%** | Good RTL PDF with header; no DOC export; double option letters |
| F5 Negative marking | **80%** | Scoring correct; no live score; report counts wrong for non-Latin |
| F6 Learning pathways | **40%** | Review screen works; recommendations not shown; downloadable report is empty |
| F7 Roles | **50%** | 4 roles + backend checks; no groups; admin over-privileged; UI guard broken |
| F8 Minimal-input creation | **65%** | Creation flow fine; edit lock UI-only, edit-with-files broken |
| F9 Security & session | **45%** | JWT + CAPTCHA ok; one-attempt broken; email-verification bypass; client-only timers |
| F10 Resource library | **30%** | Reuse via selection only; no de-dup/search; private resources leak |
| F11 Analytics | **45%** | Basic instructor/student views; no cross-student question analytics |
| **Overall (unweighted)** | **≈ 50%** | Weighted toward the differentiators (F1, F2, F3, F6): **≈ 40%** |

---

## 6. Top 10 most serious bugs (ranked by severity)

1. **CRITICAL: Account takeover via Google auth.** `POST /api/auth/google-auth` (`backend/routes/authRoutes.js:24`, no auth, no CAPTCHA) calls `googleAuthService` (`backend/services/auth.service.js:59-85`), which trusts `email`/`uid` from the request body and **never verifies a Firebase ID token**. For an existing account (any provider, any role, verified or not) it signs a JWT. Anyone who knows the Super Admin's email becomes Super Admin. The frontend (`frontend/src/store/authStore.js:50-54`) sends no ID token.
2. **CRITICAL: Correct answers sent to students at exam start.** `startAssessmentForStudentService` selects `correct_answer` and returns it in the response (`backend/services/studentAssessment.service.js:93-102`). Any student can read every answer in DevTools → Network.
3. **HIGH: "One attempt" not enforced.** Only concurrent `in_progress` attempts are blocked (`studentAssessment.service.js:69-78`). A student can retake after completing and get a new question set (and a better score). The dashboard even shows "Start" again for older completed assessments (`studentAnalyticsModel.js:52` + `StudentDashborad.jsx` `getAssessmentStatus`).
4. **HIGH: Admins can change anyone's role, including the Super Admin.** `validateRoleChange` checks only the target role (`backend/validator/user.validator.js:30-52`). `changeUserRoleService` (`auth.service.js:246-278`) never checks the target user's current role or group, so `PUT /api/auth/change-role {userId:<superadmin>, newRole:"student"}` from an Admin succeeds.
5. **HIGH: Any instructor/admin can overwrite any assessment, even after execution.** `updateAssessmentService` (`backend/services/assessment.service.js:134-192`) has no ownership check and no `is_executed` check. It also deletes all resource links of the target assessment (`:162`). The UI "lock" is only `disabled` inputs.
6. **HIGH: Refresh or disconnect = permanent lockout + lost answers.** Answers live only in an un-persisted Zustand store (`frontend/src/store/studentAssessmentStore.js`) and are saved server-side only at submit. After a refresh, Start returns `ALREADY_IN_PROGRESS` forever, and there is no resume endpoint. The same happens if LLM generation fails after the attempt row is inserted (`studentAssessment.service.js:81-89`, no cleanup). The exam screen tells students "Your progress is automatically saved" (`TakeAssessment.jsx:182`), which is false.
7. **HIGH: Exam timing is wrong and not enforced.** The backend returns total duration in **seconds** (`studentAssessment.service.js:42-45`); the store multiplies by 60 again (`studentAssessmentStore.js:60`), so 5 × 120 s questions get a 10-hour timer. Per-question timers are client-only, Previous/Next allows revisiting (`TakeAssessment.jsx:111-112`), and submit does no server-side time validation.
8. **HIGH: Document ingestion fails for common inputs.**
   - (a) OCR calls `worker.loadLanguage()`/`initialize()` (`backend/helper/textProcessor.js:21-22`). Those methods do not exist in the installed tesseract.js 6.0.1, so **every image and every scanned or low-text PDF fails**.
   - (b) `generateEmbedding` throws for chunks < 120 chars (`helper/embeddingGenerator.js:25-27`). The last 500-word chunk is often shorter, which fails the whole upload (`resource.service.js:76-81`) or the whole assessment create/edit (`assessment.service.js:396-419`, returns 500) and can leave a half-written resource.
   - (c) Edit-with-files always fails: field `new_files` vs multer's `files` (`EditAssessment.jsx:214` vs `routes/assessmentRoutes.js:40`).
9. **MEDIUM-HIGH: Frontend runtime crashes and a dead role guard.**
   - `Login.jsx:59` (`ZodError` undefined): wrong-password users get no feedback.
   - `EnrollStudents.jsx:16` (`setIsLoading` undefined): enrolled list never loads.
   - `ErrorBoundary.jsx:79` (`process` undefined): the boundary crashes.
   - `ProtectedRoutes.jsx:12` reads `allowedRoles` but `App.jsx` passes `requiredRole`, so there is no UI role gating.
10. **MEDIUM: Learning-pathway output is effectively empty.**
    - The downloadable report PDF contains only the title (`frontend/src/store/useStudentAnalyticsStore.js:107`).
    - The AI study plan is never rendered.
    - General recommendations call `generateContent` with the wrong arguments (`backend/models/studentAnalyticsModel.js:192`).
    - Short-answer grading can crash submit (`JSON.parse` on a plain string, `studentAssessment.service.js:141-147`) or accept any answer (empty keyword list; also `normalizeText` strips all non-ASCII, `:320-325`, so every Urdu/Arabic short answer is "correct").

Honourable mentions:
- Enrollment email called with the wrong arguments and able to 500 after the DB insert (`assessment.service.js:234`).
- Resource `url`/`file_type` never saved (`resourceRepository.js:5-16`).
- `/resources/all` leaks private resources.
- Gemini `generationConfig` ignored, so `temperature`/`maxOutputTokens`/JSON mode are not applied (`services/ai/generateContent.js:16-20`, `studentAnalytics.service.js:253`).
- Duplicate `GET /student-analytics/assessments` route; the second handler is unreachable (`routes/studentAnalyticsRoutes.js:19,23`).
- `fetchStudentAssessmentsApi` calls `GET /api/taking/assessments`, which doesn't exist (`frontend/src/api/assessment.api.js:51-52`).
- Student assessment list cached in Redis for 10 minutes and never invalidated on enroll/submit (`studentAnalytics.service.js:58-72`).
- Print header names get "translated" by the LLM.

---

## 7. Security concerns

| # | Severity | Finding | Location |
|---|---|---|---|
| S1 | **Critical** | Unauthenticated JWT minting for arbitrary email via `/google-auth` (no Firebase ID-token verification); also bypasses email verification and CAPTCHA | `services/auth.service.js:59-85`, `routes/authRoutes.js:24` |
| S2 | **Critical** | Correct answers returned to the student client on exam start | `services/studentAssessment.service.js:93-102` |
| S3 | **High** | **Hardcoded Upstash Redis REST URL and token** as fallbacks in source. Treat this token as compromised and rotate it. | `backend/DB/redis.js:5-6` |
| S4 | **High** | Admin can demote or alter Super Admin and other Admins; no group scoping | `validator/user.validator.js:30-52`, `services/auth.service.js:246-278` |
| S5 | **High** | Broken object-level authorization on `PUT /api/assessments/:id` (no owner check) | `services/assessment.service.js:134-192` |
| S6 | **Medium** | `GET /api/logs` is public and returns startup logs plus recent error messages **with stack traces** | `backend/index.js:125-138` |
| S7 | **Medium** | **No rate limiting anywhere** (login, signup, forgot-password, verify). LLM-backed endpoints (`/preview-questions`, `/print`, `/start`, `/report`) can be spammed and run up AI cost. No `helmet`. | whole backend |
| S8 | **Medium** | Default Super Admin password `***REMOVED***` hardcoded and **printed to the console** | `scripts/createSuperAdmin.js:67,109` |
| S9 | **Medium** | `.env` files with live credentials sit inside both app folders. The project is **not a git repo**, so `.gitignore` gives no protection when the folder is zipped, uploaded, or submitted. (Values were not read during this audit.) | `backend/.env`, `frontend/.env` |
| S10 | **Medium** | Private resources of all instructors listed via `/resources/all` and linkable by anyone with the instructor role | `repositories/resourceRepository.js:43-54`, `services/resource.service.js` link |
| S11 | **Medium** | Email verification oracle: any bogus token returns success if someone verified in the last hour; tokens never expire | `services/auth.service.js:151-158` |
| S12 | Low | User enumeration: login reveals "use Google" / "not verified" before the password check; forgot-password reveals Google accounts | `auth.service.js:97-104,172` |
| S13 | Low | Dev-mode error handler returns full error objects and stacks to clients if `NODE_ENV=development` in prod | `middleware/errorMiddleware.js:161-164` |
| S14 | Low | HTML injection: user-controlled names, titles, and LLM output interpolated unescaped into email HTML (`utils/emailTemplates.js`) and the Puppeteer page (`helper/Pdfkitgenerator.js`, launched with `--no-sandbox`) | as listed |
| S15 | Low | JWT in `localStorage` (XSS-exfiltratable), 24h lifetime, no logout invalidation | `frontend/src/store/authStore.js` |

### Non-functional checks requested

- **Password hashing:** ✅ `bcrypt` cost 10 (salted) for signup, registration, reset, and the seed script. No plaintext passwords in request logs. ⚠️ The seed script prints the default password (S8). Emails are logged in warnings (PII, minor).
- **Can one student fetch another student's questions/answers?** Not found. `/api/taking/submissions/:id` filters by `student_id = req.user.id` (`studentAssessment.service.js:212-238`). `/api/student-analytics/*` always uses `req.user.id`. `/api/instructor-analytics/...` requires role `instructor` and verifies ownership before returning answers (`models/InstructorAssessmentAnalyticsModel.js:95-98`). `GET /api/assessments/:id` for students requires enrollment and returns no questions. ⚠️ Students *do* receive their own correct answers (S2).
- **In-progress answers persisted?** ❌ No. Memory only, lost on refresh, and the attempt is then locked (BUG-6).
- **Rate limiting on auth:** ❌ None (S7). reCAPTCHA v3 on login/signup is the only throttle.
- **Hardcoded secrets committed:** ⚠️ Upstash token in `DB/redis.js` (S3); default admin password (S8). Firebase web config and the reCAPTCHA *site* key in `frontend/.env` are public by design.

---

## 8. Code that exists but isn't in the SRS (extras, dead code, leftovers)

**Extra features (working or partially working)**
- Google Sign-In via Firebase (insecure, see S1).
- Groq as a second LLM provider with random fallback.
- OCR pipeline with Tesseract and bundled `eng/ara/urd/hin` traineddata. Hindi is not in the SRS. Currently broken.
- PPT/PPTX and image upload support.
- Instructor-side `/preview-questions` sample generation, plus a "copy AI prompt" tab (`components/PromptTab.jsx`, `utils/promptGenerator.js`).
- "Gradewise-AI" watermark and answer-key page on printed papers.
- Backend CSV export of student report (`/student-analytics/report?format=csv`), not reachable from UI.
- Instructor/admin can register student accounts directly (`/auth/register-student`). The response returns a JWT *for the new student* to the registrar, which is unnecessary.
- Upstash Redis: used only for the student assessment list cache and some cache deletes. A test key is written on every boot (`DB/redis.js:10-16`). Most "Redis removed" comments show it was abandoned mid-way.

**Dead / unreachable code**
- Backend:
  - `createNewAssessment` controller and service (no route; holds the only real validation).
  - `validateAssessmentPayload`.
  - `clearLinksForAssessment`.
  - `getUsersByRole`, `searchUsers`, `getUserStats`, `userExistsByEmail`, `getUserByEmail`, `getUserById`.
  - `sendWelcomeEmail`, `sendAssessmentReminderEmail`, `testEmailConfiguration`.
  - Second `GET /student-analytics/assessments` handler (`getStudentAssessmentsList`), which references non-existent columns `percentage`/`submitted_at`.
  - `updateAssessmentExecutionStatusQuery`.
  - `GET /api/taking/assessments/:id/print` (creates fake completed attempts; the frontend function exists but nothing calls it).
  - `generateEmbedding`'s socket progress parameters (no socket server exists).
- Frontend:
  - `utils/docxGenerator.js`, `utils/pdfGenerator.js`, `hooks/useAssessmentSocket.js` (never imported).
  - `api/assessment.api.js:51` → nonexistent endpoint.
  - `studentAssessmentStore.printAssessment`.
  - The `role` destructure in `authStore.registerStudent`.

**Unused dependencies**
- Backend: `jspdf`, `pdf-lib`, `pdfkit`, `openai`, `bcryptjs` (duplicate of `bcrypt`), `socket.io`, `crypto` (npm stub of a Node built-in). `patch-package` postinstall runs, but there is no `patches/` directory.
- Frontend: `recharts`, `chart.js`, `react-chartjs-2`, `react-toast`, `react-toastify`, `lodash`, `@react-oauth/google`. `docx`, `fontkit`, `pdf-lib`, and `socket.io-client` are imported only by dead files.

**Leftovers**
- Folder names `backend_temp` / `frontend_temp` (resolved: the monorepo uses `backend/` and `frontend/`).
- Default Vite `README.md`.
- Misspelled folders and files: `scheema/`, `editAssessmnetSchemas.js`, `InstructorDashborad.jsx`, `StudentDashborad.jsx`, `AssesmentManagement/`.
- Hardcoded log URLs `http://localhost:5000` / `:5173/api/health` regardless of `PORT` (`index.js:191-192`).
- `console.log` debugging in repositories (`resourceRepository.js`) and `AddStudent.jsx:108`.
- Student list shows hardcoded `duration: 30, total_marks: 100` (`studentAnalytics.service.js:195-196`, dead path).

---

## 9. What remains to be built

### Must-have for a demo

1. **Close the two critical holes:** verify Firebase ID tokens server-side in `/google-auth` (or remove Google sign-in), and strip `correct_answer` from `/start` responses.
2. **Enforce one attempt server-side.** Reject Start if *any* attempt exists, add a `UNIQUE(student_id, assessment_id)` (excluding physical-paper rows), and fix the dashboard "completed" detection.
3. **Resume and autosave.** Save each answer as it's given (`PUT /attempts/:id/answers/:qid`), add a resume endpoint that returns the existing in-progress questions (without answers), and clean up failed generations.
4. **Fix timers.** Remove the `* 60`, auto-submit on the last question, disable going back if per-question timing is the rule, and validate timing server-side (store `answered_at` per answer, which also covers F2.1).
5. **Adaptive difficulty (F2) MVP.** It is a headline differentiator and currently 0%. Generate questions tagged by difficulty (pool or one-at-a-time), pick the next question from a rolling window of correctness and time, and weight the final score by difficulty.
6. **Learning-objective mapping (F1.4).** Have the LLM extract N objectives from the source once per assessment, store them, and generate each student's set against the same objective blueprint.
7. **Fix ingestion.** Tesseract v6 API (`createWorker(langs)`), merge or skip tiny trailing chunks, use the embeddings (top-k similarity retrieval instead of "first 5,000 chars"), and fix the `new_files`/`files` mismatch.
8. **Fix RBAC.**
   - `ProtectedRoute` prop name.
   - Ownership + `is_executed` lock on `PUT /assessments/:id`.
   - Admin cannot modify admins/super admins.
   - Protect `/change-password`.
   - Remove `/api/logs`.
   - Rotate and remove the hardcoded Redis token.
9. **Fix the frontend crashes** in Login, EnrollStudents, ErrorBoundary, and the analytics store.
10. **Show results immediately after submit** and **render the AI recommendations/study plan**. Make the downloadable report actually contain stats, weak areas, and the plan.
11. **Commit a schema/migration file** for every table plus `CREATE EXTENSION vector`, so the project can be set up on another machine (examiners will ask).

### Nice-to-have

- Full UI i18n (react-i18next) with app-wide RTL (F3.2/3.3) and the report in the student's language (F6.6).
- Groups and GroupMembership with admin scoping (F7.4); delete/password-change emails; a Notification table (F7.3/7.7/9.6).
- DOCX export by wiring up `docxGenerator.js` (F4.4); fix "A. A." option labels; keep header proper nouns untranslated.
- Link/YouTube ingestion (fetch page text, YouTube transcripts) (F1.1).
- Resource de-duplication (content hash) and search; respect private visibility (F10).
- Per-question/objective analytics across students; Super Admin platform stats (F11).
- Live scoring display (F5.4); explicit negative-marking toggle (F5.1); backend enforcement of 30 s minimum (F8.3).
- Rate limiting (`express-rate-limit`), `helmet`, CAPTCHA on forgot-password, verification-token expiry.
- Unicode-safe answer comparison in analytics SQL and short-answer grading; a robust short-answer rubric format.
- Tests (at least scoring, attempt rules, RBAC), a backend lint script, removal of unused deps, and code-splitting jsPDF/html2canvas.
