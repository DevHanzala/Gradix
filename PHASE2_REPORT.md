# Phase 2 report

Branch `phase-2` (from `main` at `d8ba9b9`), one commit per section:

| Commit | Section |
|---|---|
| 3266e49 | 0. Prep: audit fixes, pg-boss worker, LLM usage log |
| da46b32 | 1. Learning objectives, multilingual RAG, blueprint, grounded generation |
| 3e2fadb | 2. Question pool, publishing, question bank |
| e462b21 | 3. One-question-at-a-time engine with adaptive difficulty |
| f331066 | 4. Full multilingual app (en/ur/ar/fa) |
| 3298e7b | 5. Learning pathways |
| 0256e4c | 6. Institutions, scoped admins, notifications |
| dda3445 | 7. Remaining SRS features |
| 5478973 + bdf4b60 | Final verification: fixes, report, evidence |
| (this commit) | Post-release fixes: stuck "finding objectives", per-key free-plan AI usage (section 11) |

**Result:** every Phase 2 item is done, except three that are partial and explained below: 4.8 (native
review of translations), 7.6 (YouTube transcripts not tested live) and final-verification item 3 (the live
smoke test did not cover every LLM purpose; the real-stack run in section 11 then covered them). Gate 2 passes
6/6. lint, i18n:check, build and 270 tests pass.
Overall completion went from about 65% after Phase 1 to about **89%** (scoring in section 9). Phase 1
behaviour is intact: all Phase 1 tests still pass, with the exam tests moved to the new one-question API
and all 21 rules kept.

Detailed per-section notes and every decision are in `PHASE2_PROGRESS.md`. Evidence (logs, Gate 2 PDFs/DOCX,
screenshots, scripts) is in `docs/phase2-evidence/`.

---

## 1. Checklist

Status: **Done**, **Partial** (works, with a stated gap) or **Not done**. File lists name the main files;
`git show --stat <commit>` has the complete list.

### 0. Prep

| # | Item | Status | Main files |
|---|---|---|---|
| 0.1 | npm audit: non-breaking fixes, majors listed with risk | Done | package-lock.json, root package.json (`overrides`), PHASE2_PROGRESS.md D0.1/D8.4 |
| 0.2 | pg-boss jobs, `npm run worker`, in root dev script, idempotent + retry/backoff | Done | backend/jobs/{registry,queue,index}.js, backend/jobs/definitions/*, backend/worker.js, package.json |
| 0.3 | LLM usage log; all LLM calls through one function | Done | migrations/1760000000100_llm-usage-log.sql, services/ai/generateContent.js |

### 1. Learning objectives + real RAG

| # | Item | Status | Main files |
|---|---|---|---|
| 1.1 | Re-chunk ~200–250 tokens, 15% overlap, sentence/paragraph aware, ur/ar/fa; re-chunk job | Done | helper/chunker.js, jobs/definitions/resources.js, scripts/rechunkResources.js |
| 1.2 | Relaxed quality filter, clear rejection messages | Done | helper/textQuality.js, helper/textProcessor.js |
| 1.3 | Objectives table; 3–15 objectives extracted by retrieval, not text dump | Done | migrations/…200_objectives-and-rag.sql, services/objectives.service.js, jobs/definitions/objectives.js |
| 1.4 | Objective review UI; status flow draft → objectives_ready → publishing → published → executed | Done | Pages/Instructor/AssessmentManagement/AssessmentObjectives.jsx, components/assessment/AssessmentStatus.jsx |
| 1.5 | Stored blueprint (questions per objective, difficulty mix, types) | Done | services/blueprint.js |
| 1.6 | Top-k pgvector retrieval per objective; vector index | Done | services/rag/retrieval.js, HNSW index in migration 200 |
| 1.7 | Questions store objective_id, difficulty, language, type, source_chunk_ids, stem hash | Done | services/questions/generator.js, services/questions/validation.js |

### 2. Question pool + pre-generation

| # | Item | Status | Main files |
|---|---|---|---|
| 2.1 | Pool per objective × difficulty × language on publish; sized for ≥ 30 students | Done | migrations/…300_question-pool.sql, services/pool/{targets,pool.service}.js, jobs/definitions/pool.js |
| 2.2 | Native generation; validation (one correct, distinct options, language, no leak); regenerate invalid | Done | services/questions/validation.js, generator.js |
| 2.3 | No repeats within a student; no identical full sets across students (tested) | Done | services/pool/pool.service.js; tests/pool.test.js (30 students → 30 distinct sets) |
| 2.4 | Background top-up; on-demand generation with timeout and fallback, never 500 | Done | pool.service.js (`POOL_ON_DEMAND_TIMEOUT_MS`, 503 POOL_EXHAUSTED) |
| 2.5 | Question bank: browse, preview, edit (versioned), delete, regenerate one, add manual, approve | Done | services/pool/bank.service.js, Pages/…/QuestionBank.jsx, components/assessment/QuestionEditor.jsx |
| 2.6 | Publishing progress; students wait until their language is ready | Done | components/assessment/PublishPanel.jsx, services/assessmentAvailability.js |
| 2.7 | Short answer in create UI; AI rubric; shared grader; rubric visible in bank | Done | utils/grading.js, AssessmentForm.jsx, QuestionEditor.jsx |

### 3. Adaptive difficulty engine

| # | Item | Status | Main files |
|---|---|---|---|
| 3.1 | Adaptive on/off per assessment; fixed mix when off | Done | AssessmentForm.jsx, services/blueprint.js |
| 3.2 | Server serves one question at a time; the next question never exists early | Done | services/studentAssessment.service.js, migrations/…400_adaptive-engine.sql |
| 3.3 | Start at 3, rolling window of 3 (correctness + time), thresholds in one documented config | Done | services/engine/adaptiveConfig.js |
| 3.4 | Raw + difficulty-adjusted score, difficulty path, documented normalisation | Done | adaptiveConfig.js `computeScores`, D3.3 |
| 3.5 | Resume after refresh | Done | studentAssessment.service.js, store/studentAssessmentStore.js |
| 3.6 | Engine tests (up/down, bounds, equal coverage, scoring, no early question) | Done | tests/engine.test.js, tests/exam.test.js |

### 4. Full multilingual app

| # | Item | Status | Main files |
|---|---|---|---|
| 4.1 | react-i18next; every user-facing string in en/ur/ar (+ fa complete) | Done | frontend/src/i18n/index.js, frontend/src/locales/{en,ur,ar,fa}/*.json (834 keys) |
| 4.2 | `npm run i18n:check` (missing keys, hard-coded strings), in lint | Done | frontend/scripts/i18n-check.mjs |
| 4.3 | `dir`/`lang` on `<html>`, RTL everywhere, logical classes, mirrored icons | Done | i18n/index.js, layouts/*, components/ui/* |
| 4.4 | Noto Nastaliq Urdu / Noto Naskh Arabic in app and every PDF | Done | frontend/public/fonts, App.css, backend/helper/pdfFonts.js |
| 4.5 | `language_preference` (migration), selectors on login/top bar/profile, per-exam language | Done | migrations/…500_i18n.sql, components/LanguageSwitcher.jsx |
| 4.6 | Intl formatting | Done | frontend/src/utils/format.js |
| 4.7 | Emails in the recipient's language | Done | backend/helper/i18n.js, backend/locales/*.json, utils/emailTemplates.js |
| 4.8 | Natural translations; uncertain ones in TRANSLATION_REVIEW.md | **Partial** | TRANSLATION_REVIEW.md. Written carefully, but no native speaker has reviewed them yet. |
| 4.9 | Persian OCR data; optional Gemini OCR fallback behind a flag; path logged | Done | assets/tessdata/fas.traineddata, helper/textProcessor.js (`OCR_GEMINI_FALLBACK`) |

### 5. Learning pathways

| # | Item | Status | Main files |
|---|---|---|---|
| 5.1 | Results right after submit: scores, accuracy, time, objective bars, difficulty chart | Done | services/learning/results.service.js, Pages/Student/Results.jsx, components/results/* |
| 5.2 | Answer review with objective; only after submission | Done | components/assessment/AnswerReview.jsx |
| 5.3 | Weak areas by objective | Done | results.service.js (WEAK_THRESHOLD 60%) |
| 5.4 | AI study plan in the student's language with exact source passages | Done | services/learning/studyPlan.service.js, components/results/StudyPlanPanel.jsx |
| 5.5 | Server PDF report (stats, objectives, path, weak areas, plan, practice questions), stored | Done | services/learning/report.service.js, migrations/…600_learning-pathways.sql. The practice section was added during final verification. |
| 5.6 | Ungraded unlimited practice from the same objectives | Done | services/learning/practice.service.js, components/results/PracticeQuiz.jsx |
| 5.7 | Old analytics endpoints removed or wired | Done | removed from routes/studentAnalyticsRoutes.js and services/studentAnalytics.service.js |

### 6. Institutions, roles, notifications

| # | Item | Status | Main files |
|---|---|---|---|
| 6.1 | Groups + memberships; admins scoped to their groups, student ↔ instructor only | Done | migrations/…700_institutions.sql, services/group.service.js, services/auth.service.js |
| 6.2 | Enroll a whole group | Done | assessment routes `/:id/enroll-group`, EnrollStudents.jsx |
| 6.3 | Super Admin sets any role and manages groups | Done | components/UserManagement.jsx, Pages/Groups.jsx |
| 6.4 | Notifications table + bell; events: role, deletion (email), password, enrollment, published, results | Done | services/notification.service.js, services/lifecycleNotifications.js, components/NotificationBell.jsx |
| 6.5 | Deletion removes personal data, keeps anonymous results | Done | services/auth.service.js (`users.deleted_at`) |
| 6.6 | Tests for every scope rule | Done | tests/institutions.test.js, tests/rbac.test.js |

### 7. Remaining SRS features

| # | Item | Status | Main files |
|---|---|---|---|
| 7.1 | DOCX export with the same headers, RTL, fonts; format chosen in the dialog | Done | services/paper/paperRender.js, components/PhysicalPaperModal.jsx |
| 7.2 | Same paper / unique paper per student + combined answer key | Done | services/paper/paperSets.js |
| 7.3 | Header proper nouns never translated | Done | assessment.service.js `generatePhysicalPaperService` (no LLM call) |
| 7.4 | Negative-marking toggle; show live score (default off) | Done | migrations/…800_remaining-srs.sql, AssessmentForm.jsx; live score in section 3 |
| 7.5 | 30-second minimum enforced by the backend | Done | validator + DB CHECK `chk_question_blocks_min_duration` |
| 7.6 | Web page ingestion (Readability) and YouTube transcripts through the same pipeline | **Partial** | helper/linkIngest.js, helper/resourceIngest.js. Both work and are tested with a fake fetcher. The YouTube path reads caption tracks from the watch page (no official API) and was not tested against live YouTube. |
| 7.7 | Library: content-hash dedupe, search (title/content/type/language), filters, pagination | Done | services/resource.service.js, Pages/…/ResourceManagement.jsx |
| 7.8 | Instructor analytics: per objective, hardest, distribution, difficulty reached, CSV/Excel | Done | services/insights.service.js, Pages/…/AssessmentAnalytics.jsx, components/insights/ScoreDistribution.jsx |
| 7.9 | Super Admin platform stats incl. LLM calls; AI usage per key and per day (no cost: free plans, section 11) | Done | services/platformStats.service.js, services/ai/keyPool.js, components/PlatformStats.jsx |

### Final verification

| # | Item | Status | Evidence |
|---|---|---|---|
| F.1 | lint, i18n:check, build, test all pass | Done | docs/phase2-evidence/checks.log |
| F.2 | Puppeteer screenshots 360/768/1280, en + ur, automatic checks, fixes | Done | 135 screenshots (Arabic added too), 0 issues on the final run; docs/phase2-evidence/screenshot-checks.csv |
| F.3 | Live Gemini smoke test (keys present) | **Partial** | docs/phase2-evidence/smoke-live-gemini.log: objectives + questions in en and ur passed. The study plan and practice purposes were not exercised live. |
| F.4 | Gate 2 end to end | Done | 6/6, docs/phase2-evidence/gate2/gate2.log |

---

## 2. Commands and results

| Command | Result |
|---|---|
| `npm run lint` | pass (backend ESLint, frontend ESLint + i18n check: 834 keys, 98 files) |
| `npm run i18n:check` | pass |
| `npm run build` | pass (warning: chunks > 500 kB) |
| `npm test` | 13 suites, **259 tests pass** (Phase 1 ended with 108) |
| Migrations 100–800 | each run up → down → up on Docker Postgres 16 + pgvector, clean |
| `npm audit --omit=dev` | 11 advisories left (4 high, 7 moderate), all needing a major change, listed in section 7 |
| Screenshot pass (`docs/phase2-evidence/scripts/shoot.mjs`) | 135/135 clean |
| Gate 2 (`docs/phase2-evidence/scripts/gate2.mjs`) | 6/6 pass |
| Live smoke (`docs/phase2-evidence/scripts/smoke.mjs`) | pass, 8 LLM calls, 25 s |

How the verification stack ran: a throwaway database on the Docker Postgres container (`gradix_demo`,
`gradix_gate`, `gradix_smoke`; never the developer database). The LLM, email and embeddings were the test
fakes. The frontend was a production build pointed at the demo API. The `.env` files were never read or
printed; only the presence of the AI key names was checked before the live test.

---

## 3. Screenshot checks

The pages were the instructor's resources, create, detail, print dialog, objectives, question bank, analytics
and enroll pages; the student dashboard, notifications, exam and results; admin groups; and the super admin
dashboard and groups. Each was captured at 360, 768 and 1280 px in English, Urdu and Arabic.

Automatic checks on every screenshot: horizontal page overflow, elements outside the viewport, `<html dir>`,
raw i18n keys or `{{placeholders}}`, unlabeled controls, touch targets (44 px; 24 px for inline links and
checkboxes inside labels), console errors and failed API calls. Latin words on the RTL pages were also
listed and checked by hand; only names and user data remained.

Found and fixed:
1. On the assessment detail page at 768 px, the header actions overflowed the page by 198 px. Fixed in
   `components/ui/Display.jsx`: the actions wrap within 60% of the width.
2. The print dialog opened in English for Urdu and Arabic users. It now starts in the UI language.
3. An English exam inside the Urdu UI used the Urdu font and Urdu number and duration formats. Fixed with
   `[lang="en"]` font reset in `App.css` and an exam-language parameter in `utils/format.js`.
4. A timed-out Urdu exam showed its result in English and LTR after a reload. The store dropped the
   attempt language. Fixed in `store/studentAssessmentStore.js`.
5. Source links on the detail page and in the library were under 44 px tall. Fixed with `min-h-11`.
6. Platform stats printed "null" for a model without a name.

Puppeteer's `fullPage` capture shifts some RTL pages sideways. That is a capture artifact (the DOM and
viewport renders were correct), so the final pass resizes the viewport instead.

Representative screenshots are in `docs/phase2-evidence/screenshots/`. The full set is regenerated by the
scripts in `docs/phase2-evidence/scripts/` (`demoServer.mjs`, then `shoot.mjs`).

---

## 4. Live LLM smoke test

The AI keys were present, so the test used the real providers (values never read or printed) on a
throwaway DB. Input: one 5-sentence text resource, 1 MCQ block × 3 questions, published in English and Urdu.

- Objectives: 9 extracted ("Define photosynthesis", "Identify the inputs…", "Describe the role of
  chlorophyll", …), status `objectives_ready`.
- Pool: both languages `ready`, 10 validated questions each. The Urdu questions are natural Urdu written
  directly in the language (e.g. «اگر ایک پودے کو خوراک بنانے کا عمل مکمل کرنا ہو تو اسے کن چیزوں کی ضرورت ہوگی؟»).
- Token usage (from `llm_usage_log`, real counts, not estimates):

| Purpose | Provider / model | Calls | Input tokens | Output tokens | Avg latency |
|---|---|---|---|---|---|
| objective_extraction | gemini / gemini-2.5-flash | 1 | 309 | 573 | 3.4 s |
| pool_generation | gemini / gemini-2.5-flash | 3 | 1,527 | 1,584 | 3.0 s |
| pool_generation | groq / openai/gpt-oss-20b | 4 | 2,192 | 3,879 | 1.6 s |
| **Total** | | **8 (all succeeded)** | **4,028** | **6,036** | 25 s end to end |

The calls were split between providers by the existing random pick from the creation pool.
**Observation:** 9 objectives for a 3-question assessment means 6 objectives get no question in that
assessment. This is listed under known issues.

---

## 5. Gate 2 results

The script ran end to end through the real API on a throwaway DB, with the fake LLM and real Chromium
PDFs. Full log: `docs/phase2-evidence/gate2/gate2.log`. The PDFs and DOCX files are next to it.

| Gate 2 check | Result | Evidence |
|---|---|---|
| Two students get different sets covering the same objectives the same number of times | **PASS** | Adaptive 8-question exam: students A and B share 0 of 8 questions; objective counts are identical: `{"1":4,"2":2,"3":2}` for both. Also `tests/pool.test.js`: 30 students → 30 distinct sets. |
| Difficulty visibly adapts and the adjusted score is correct | **PASS** | A (all correct): 3→3→4→4→5→5→5→5, adjusted 100%. B (4 right, then 4 wrong): 3→3→4→4→5→5→4→4, raw 50%, adjusted 55%. Both match an independent recomputation with weights 0.6/0.8/1.0/1.2/1.4. |
| Whole app switches to Urdu and Arabic with correct RTL; exam, results and PDF in the student's language | **PASS** | Questions served only in ur / ar. The report PDFs embed Noto Nastaliq Urdu / Noto Naskh Arabic (`report-ur.pdf`, `report-ar.pdf`). UI: 45 Urdu and 45 Arabic screenshots, all `dir="rtl"`, no untranslated strings. |
| Student sees results immediately and downloads a full report | **PASS** | The result is returned with the last answer. GET results → 200 with 8 reviewed questions and 3 objectives. report.pdf → 200 (294 KB Urdu, 196 KB Arabic), with stats, objectives, path, weak areas, plan and practice questions. |
| An admin only sees their own group | **PASS** | The admin's user list contains only the 4 group members. Changing the role of an outsider → 403 OUT_OF_SCOPE; of a group member → 200. `tests/institutions.test.js` covers every scope rule. |
| A paper prints as PDF and DOCX, same-paper and unique-paper | **PASS** | PDF same / unique×3 and DOCX same / unique×3 all return 200 with valid files. The DOCX keeps the Urdu institute name exactly as typed and has RTL runs. |

---

## 6. New environment variables

All are in `backend/.env.example` with placeholders, and all are optional (defaults in code).

| Variable | Section | Purpose (default) |
|---|---|---|
| `WORKER_CONCURRENCY` | 0 | Jobs processed in parallel by `npm run worker` (2) |
| `JOB_POOL_MAX` | 0 | Postgres connections for pg-boss (4) |
| `LLM_LOG_RETENTION_DAYS` | 0 | Days of LLM usage log kept by the daily prune job (365) |
| `EMBEDDING_MODEL` | 1 | Embedding model (`Xenova/multilingual-e5-small`) |
| `EMBEDDING_CACHE_DIR` | 1 | Where model files are cached |
| `POOL_ON_DEMAND_TIMEOUT_MS` | 2 | Max wait for an on-demand question when a pool bucket is empty (20000) |
| `OCR_GEMINI_FALLBACK` | 4 | `true` sends low-quality OCR pages to Gemini (off: documents go to a third party) |
| `JOBS_IN_API` | 11 | `true` (default): the API runs the background jobs itself. Set `false` only when `npm run worker` runs separately |
| `LLM_FREE_LIMITS_JSON` | 11 | Your free-plan limits per model (defaults: Gemini 2.5 Flash 250 requests/day; Groq gpt-oss-20b 1,000 requests and 200,000 tokens/day) |
| `GEMINI_CREATION_API_KEY_3…`, `GROQ_API_KEY_2…` | 11 | Any number of extra keys; calls are spread over all keys with quota left |

There are no new frontend variables.

---

## 7. Decisions

All decisions with reasons are in `PHASE2_PROGRESS.md` (D0.1–D8.4). The ones that matter most for
integrity and fairness:

- **D2.2** Unapproved AI questions are served. They passed automatic validation, and approval is a review
  marker; requiring it would block every exam on manual review.
- **D2.4** Fallback order is the same difficulty from the LLM first (bounded wait), and a nearby difficulty
  only if that fails.
- **D3.1** One engine and one API for every assessment.
- **D3.2** A missed question window counts as "not reached"; its question is never shown later.
- **D3.3** The adjusted % is normalised to medium difficulty and capped at 100; the raw % is always shown
  next to it.
- **D5.1 / D8.2** Practice questions, including those in the PDF report, are generated fresh and never come
  from the exam pool.
- **D6.1 / D6.2** An admin with no group manages nobody, and only the super admin can change group
  membership.
- **D7.1** Printed questions count as served.
- **D7.3** The negative-marking switch is snapshotted at attempt start.
- **D7.5** Link fetching refuses private and internal addresses (SSRF protection).
- **D8.4** Vulnerable pins inside office-text-extractor are patched with scoped overrides instead of the
  breaking v4 upgrade.

---

## 8. Known issues

1. **Dependencies (11 advisories, all need a major change):**
   - `firebase` → firestore/grpc (high): firestore is never imported, only `firebase/auth`.
   - `office-text-extractor` → `file-type` (moderate, a DoS in the ASF media parser); v4 is a breaking upgrade.
   - `exceljs` → `uuid` (moderate): npm's suggested fix is a downgrade.
   - `mammoth` → `argparse` → `sprintf-js` (moderate, CLI argument parsing the app doesn't use).
2. ~~Objectives can outnumber questions.~~ Fixed in section 11: extraction never produces more objectives
   than questions, and the objectives page warns when manual edits leave objectives without a question.
3. **YouTube transcripts** depend on the caption tracks embedded in the watch page. A YouTube page change
   produces a clear "no captions" message, not a crash. Not tested live.
4. **Translations** need a native speaker's review (`TRANSLATION_REVIEW.md`). Non-English UIs show
   translated error codes, so some server details are lost (D4.2).
5. **No frontend unit tests.** Frontend behaviour is verified by the Puppeteer pass, lint and the i18n
   check.
6. **Build size:** Vite warns about chunks over 500 kB; no code splitting yet.
7. **Free-plan limits** are the published values at the time of writing and change often; they count per
   Google project / Groq account. Set `LLM_FREE_LIMITS_JSON` if your plan differs.
8. **Secrets** that were in the old repos' git history must be rotated (from the monorepo merge).
9. **Adaptive thresholds** (`adaptiveConfig.js`) are reasoned defaults, not yet tuned on real student data.

---

## 9. Phase 3 notes

None of the following were built. They are noted as temptations in `PHASE2_PROGRESS.md`:
- Proctoring: logging tab switches or focus loss. The one-question engine makes it easy to add.
- Image questions from diagrams the OCR pipeline already sees.
- Matching questions in the bank editor.
- Offline/PWA exam caching (today there is only a retry of unsaved answers).
- A live class view.
- Polls and exit tickets on top of the practice-quiz component.
- Per-institution plans or limits based on the LLM usage log.
- Deployment (Docker compose for app + worker).

Useful groundwork for Phase 3 already exists: the per-question timing data, the notification system, the
LLM usage log and the pg-boss worker.

---

## 10. Completion per feature (scored as strictly as AUDIT.md)

| Feature | Audit | Phase 1 | **Phase 2** | Why not higher |
|---|---|---|---|---|
| F1 Unique AI questions | 55% | 65% | **90%** | YouTube untested live; no warning when objectives outnumber questions |
| F2 Adaptive difficulty | 5% | 15% | **90%** | Thresholds not tuned on real data |
| F3 Multilingual + RTL | 55% | 60% | **85%** | Translations not natively reviewed; non-English errors less specific |
| F4 Print generation | 80% | 85% | **90%** | DOCX relies on the reader's installed fonts (PDF embeds them) |
| F5 Negative marking | 80% | 90% | **95%** | Only snapshot semantics; nothing material missing |
| F6 Learning pathways | 40% | 60% | **90%** | Study-plan quality verified with the fake LLM only |
| F7 Roles | 50% | 65% | **90%** | No email-change feature (SRS 9.6) |
| F8 Minimal-input creation | 65% | 90% | **95%** | Objective count vs question count not checked |
| F9 Security & session | 45% | 85% | **88%** | JWT has no refresh/revocation; proctoring is Phase 3 |
| F10 Resource library | 30% | 45% | **85%** | Dedupe is exact-content only; search is text, not semantic |
| F11 Analytics | 45% | 50% | **80%** | No per-question item analysis (difficulty/discrimination per pool question) |
| **Overall (unweighted)** | **≈ 50%** | **≈ 65%** | **≈ 89%** | Weighted toward F1, F2, F3, F6: ≈ 89% |

---

## 11. Post-release fixes (after merging to main)

**Reported problem:** a created assessment stayed on "finding objectives" and could not be started.

**Cause:** background jobs (objective extraction, question pools) were put in the database queue, but only the
separate `npm run worker` process executed them. With just the backend running, nothing ever processed the
queue. The Regenerate button was also disabled while extraction was "running", so there was no way out in the UI.

**Fixes:**
- The backend runs the background jobs itself (`backend/jobs/runner.js`, started from `index.js`); `npm run worker`
  is optional (`JOBS_IN_API=false`). The root `npm run dev` no longer starts a second worker.
- On startup and every 5 minutes, assessments still extracting objectives and languages still filling their pool
  are re-queued (de-duplicated per assessment). Assessments that were already stuck recover on the first start.
- After 3 minutes the objectives page shows "This is taking longer than usual" with a working **Try again**.
- Objectives never outnumber questions (the 9-objectives-for-4-questions case), with a warning for manual edits.

**AI usage on free plans (no cost):**
- Any number of keys: `GEMINI_CREATION_API_KEY_1..N`, `GROQ_API_KEY`, `GROQ_API_KEY_2..N`. Each call shuffles over
  the keys that still have free quota today, falls back to another key on failure (up to 3), and a key the
  provider rate-limits is parked: for a minute, or until its daily reset for a daily limit.
- Every call is logged with its key label (migration `1760000000900_llm-key-usage.sql`; the key itself is never
  stored or shown).
- The Super Admin dashboard shows: AI requests and tokens today, keys available, per key "requests used / limit",
  "tokens used / limit", what is left, status (Available / Almost used up / Paused / Limit reached) and reset
  time, plus a tokens-per-day chart and usage by model and purpose. All cost figures were removed.

**Verification:**
- 270 backend tests (11 new: key rotation, daily-limit parking, usage accounting, stats without cost, stuck-work
  recovery, stalled flag, objective cap), lint + i18n check (862 keys), build.
- Migrations 100–900 up → down → up on a fresh database.
- **Real-stack run, 13/13 pass in 112 s** (`docs/phase2-evidence/e2e/`): one `node index.js` process (no worker),
  real pg-boss queue, your real AI keys, a browser clicking through the production build:
  - instructor creates an assessment with an uploaded file;
  - 4 objectives for 4 questions appear in 11 s;
  - publishing builds 12 English and 12 Urdu questions in 68 s;
  - an English and an Urdu student take the exam one question at a time and get different questions;
  - results, AI study plan, practice and PDF reports work (en + ur);
  - analytics, PDF and DOCX printing, and the super admin usage view work;
  - an admin without a group sees nobody.

  The 19 AI calls were spread over gemini-1, gemini-2 and groq-1, with no failures.
- Layout and translation checks on the changed pages in English, Urdu and Arabic at 360/768/1280: 45/45 clean.
