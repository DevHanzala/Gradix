# Phase 2 progress

Branch: `phase-2` (from `main` at `d8ba9b9`). One commit per numbered section.
Resume rule: read this file, check `git log --oneline main..phase-2`, continue with "Next".

## Status

| Section | Status | Commit |
|---|---|---|
| 0. Prep (audit, pg-boss worker, LLM usage log) | done | 3266e49 |
| 1. Learning objectives + real RAG | done | da46b32 |
| 2. Question pool + pre-generation | done | 3e2fadb |
| 3. Adaptive difficulty engine | done | e462b21 |
| 4. Full multilingual app | done | f331066 |
| 5. Learning pathways | done | 3298e7b |
| 6. Institutions, roles, notifications | done | 0256e4c |
| 7. Remaining SRS features | done | dda3445 |
| Final verification + PHASE2_REPORT.md | done | 5478973 + final commit |

## Next
Phase 2 is complete, plus the post-release fixes (PHASE2_REPORT.md section 11). See PHASE2_REPORT.md for the full report and docs/phase2-evidence/ for the evidence.
Nothing from Phase 2 is left in progress; known issues are listed below and in the report.

## Section 0 summary
- npm audit: non-breaking fixes applied (lockfile only). Upgraded nodemailer 6 -> 10 and puppeteer 24 -> 25
  (smoke-tested: sendMail via jsonTransport, PDF render). Remaining majors noted below.
- pg-boss 12 job system: backend/jobs/{registry,queue,index}.js, backend/worker.js, `npm run worker`,
  worker included in root `npm run dev`. Retry with exponential backoff by default (4 retries, 15s..600s).
  Tests run jobs inline (same retry semantics). Real pg-boss smoke-tested against Docker Postgres.
- LLM usage log: migration 1760000000100_llm-usage-log.sql; generateContent is the only LLM entry point
  and logs every provider attempt (purpose, assessment, user, provider, model, tokens real or estimated,
  latency, success, error). Prune job (daily 03:30) keeps LLM_LOG_RETENTION_DAYS.
- New env: WORKER_CONCURRENCY, JOB_POOL_MAX, LLM_LOG_RETENTION_DAYS.
- Tests: 117 (9 new).

## Section 1 summary
- Embeddings: @huggingface/transformers + multilingual-e5-small (384 dims, same column size, "passage:"/"query:"
  prefixes). Verified cross-lingual: EN query vs UR passage 0.89. Removes the critical @xenova/protobufjs advisory.
- Chunker (helper/chunker.js): target 220 / max 260 model tokens (real tokenizer), 15% overlap by whole
  sentences, paragraph-aware, sentence ends for . ! ? ۔ ؟ ؛, long sentences split at clauses then words, tiny tail
  merged. Real-model smoke: UR chunks 226 tokens, EN 202-222.
- Quality filter (helper/textQuality.js): accepts >= 3 words / 12 letters (a short surah or poem passes); rejects
  empty, symbol soup and 1-letter-token OCR noise with specific 422 messages.
- Resources now keep content_text, content_hash (sha256), language (script detection), chunking_version 2,
  embedding_model; chunks keep token_count. Job `resources.rechunk` + `resources.rechunk-sweep` (queued by the
  worker on start, or `npm run rechunk [-- --now]`) rebuilds Phase 1 resources from their old chunks.
- Migration 1760000000200: objectives table, lifecycle (status, objectives_state/error), blueprint JSONB,
  adaptive flag, question metadata columns, HNSW cosine index. Up/down/up verified on Postgres 16 + pgvector.
- Objectives: job `objectives.extract` (stately per assessment, 3 attempts) retrieves top-40 chunks for
  title+prompt, MMR-selects 12 diverse passages (all if <= 12), LLM returns 3-15 objectives with weights and
  cited chunk ids (ids validated against the assessment). Runs after create, and after edits that change
  title/prompt/links/resources; block-only edits keep objectives and only re-plan the blueprint.
- API: GET/PUT /api/assessments/:id/objectives (full replace: edit/add/delete/reorder/weights, 1-15 items,
  owner or super_admin, locked once publishing), POST /objectives/regenerate (202).
- Blueprint (services/blueprint.js): questions per objective by weight (largest remainder, every objective >= 1),
  question types spread evenly from the blocks, fixed difficulty mix 10/20/40/20/10 per objective when not
  adaptive, objectives interleaved. Deterministic, identical for all students.
- Retrieval (services/rag/retrieval.js): pgvector `<=>` restricted to the assessment's linked resources.
- Generator (services/questions/generator.js + validation.js): per objective, top-4 retrieved + source chunks
  (max 6) are the ONLY context; difficulty rubric 1-5; validation (option count, distinct options, exactly one
  correct answer that is an option, language script, no answer leak, stem hash de-dup); invalid ones are
  re-requested (3 rounds). Questions store objective_id, difficulty, language, source_chunk_ids, stem_hash.
  Start/preview/print use it when a blueprint exists; assessments without objectives keep the Phase 1 path.
- UI: objectives page (/instructor/assessments/:id/objectives) with edit/add/delete/reorder/weights, regenerate
  (confirm), live polling while extracting, question plan; lifecycle badge + step indicator on list/detail;
  create now lands on the objectives page.
- New env: EMBEDDING_MODEL, EMBEDDING_CACHE_DIR. Tests: 157 (39 new).

## Section 2 summary
- Migration 1760000000300: question_pool (bucket = assessment, language, objective, type, difficulty; versioned
  edits via previous_version_id; status active/retired; approval; times_served; e5 embedding), unique active
  stem per assessment+language, pool_language_state, assessments.languages (default en/ur/ar) + published_at,
  generated_questions.pool_question_id. Up/down/up verified on Postgres 16.
- Sizing (services/pool/targets.js): minimum per bucket = what one student can need; target sized so the pool
  allows >= 30 different full sets (product of C(target, minimum)); adaptive pools hold all 5 difficulties.
- Publishing: POST /api/assessments/:id/publish {languages} -> status publishing, job `pool.fill` per language
  (stately, 5 attempts, backoff). Each run generates only the deficit (<= 10 per LLM call, per objective, from the
  objective's retrieved passages), validates, drops hash duplicates and embedding near-duplicates (cos >= 0.95),
  inserts. Language "ready" when every bucket reaches its minimum; assessment "published" when all are ready.
  Final failure -> language "failed" with a message; POST /publish/retry. GET /pool/status for progress.
- Serving: least-served unseen question per slot (random among equals) -> on-demand generation (timeout,
  POOL_ON_DEMAND_TIMEOUT_MS) -> nearest difficulty -> 503 POOL_EXHAUSTED (never 500; no attempt created).
  Last slot skips a candidate that would duplicate another student's full set. Top-up job queued when a
  bucket is below target (incl. exposure: target grows with times_served / 5).
- Students: start only when published/publishing AND their language is ready (409 NOT_PUBLISHED /
  POOL_NOT_READY with a "being prepared" message); dashboard + attempt state expose available languages.
- Question bank API + page: filters (language, objective, difficulty, type, status, search), pagination,
  preview with correct answer, edit (new version; attempts keep their copy), add manual (validated, auto-
  approved), approve, remove (retire), regenerate one. Publish panel with per-language progress bars.
- Short answer: AI rubric {answer, rubric:[{concept, accept[]}], min_required_match}; graded by the shared
  grader (any accepted wording counts per concept); old keyword rules unchanged.
- New env: POOL_ON_DEMAND_TIMEOUT_MS. Tests: 185 (28 new), incl. 30 students -> 30 distinct sets.

## Section 3 summary
- Migration 1760000000400: assessments.show_live_score; attempts.plan (blueprint snapshot), adaptive,
  current_difficulty, serve_delay_ms, raw/adjusted score + percentage, difficulty_path; generated_questions.served_at
  + unique (attempt_id, question_order); student_answers.time_taken_seconds, timed_out, graded_at.
- One engine for all assessments (services/studentAssessment.service.js). The API exposes only the CURRENT
  question (`question`, `totalQuestions`, `savedAnswer`); pool attempts choose each question only when its slot
  opens (the next question does not exist anywhere before it is served). Phase 1 assessments keep their
  pre-generated set but reveal it one question at a time.
- A question closes on Next, on timeout (counts as wrong if unanswered) or at submit and is graded then:
  score, correctness, answered_at, time_taken. Slots whose windows passed while away are "not reached"; their
  marks still count in the total (submitting early never inflates a percentage). Waiting for a question to be
  prepared is added back to the deadline (serve_delay_ms).
- Adaptive rules in services/engine/adaptiveConfig.js (documented there): start 3; performance per answer
  (wrong/timeout 0; correct 1 minus up to 0.3 for slowness beyond half the time); recency-weighted rolling mean of
  the last 3 since the last change; >= 0.75 up, <= 0.4 down, needs 2 answers; bounded 1..5. Difficulty is replayed
  from graded rows, so it is deterministic and resume-safe. Objective/type order always follows the blueprint.
- Scoring: raw (unchanged rules) + adjusted (correct x weight 0.6/0.8/1.0/1.2/1.4; 100% = full marks at medium;
  a fixed 10/20/40/20/10 mix all-correct = 100%; capped at 100, uncapped score stored) + difficulty path.
- Live score (also a section 7 item, done here): off by default; when on, advance returns lastAnswer and the state
  a running score. With it off no correctness field is ever sent during an attempt (tested).
- UI: adaptive + live-score toggles on the assessment form; exam page shows one question, "Preparing your next
  question…" while serving, live score when enabled; result shows the difficulty-adjusted %.
- Phase 1 exam tests migrated to the new contract (all 21 rules kept) + "later questions never reach the
  browser". Tests: 209 (23 new in engine.test.js incl. strong vs weak path, same objective order, timeouts,
  resume, parallel advance, early submit, offline catch-up).

## Section 4 summary
- react-i18next with catalogs per area in frontend/src/locales/{en,ur,ar,fa}/<area>.json (673 keys each;
  Persian is complete, not only exam/reports). Language: account preference > saved choice > browser.
  <html lang dir> follow the language; layout uses logical classes (ms/me/ps/pe/start/end) and arrow icons
  mirror with rtl:rotate-180 (scan found no physical classes left).
- `npm run i18n:check` (frontend/scripts/i18n-check.mjs) runs inside `npm run lint`: key parity en/ur/ar,
  Persian coverage of the required areas, identical {{placeholders}} and <tags>, every static t() key exists,
  and no hard-coded user-facing text (JSX text, user-facing attributes, toast/message literals, labels).
- zod messages are i18n keys ("key|value" for numbers) translated by validateWith/issuesToErrors.
  API errors: English shows the server's specific message; other languages show the translated error code.
- Intl formatting helpers (utils/format.js): numbers, percentages, dates, durations, file sizes; countdown
  timers keep Latin digits.
- Fonts (SIL OFL, self-hosted): Noto Nastaliq Urdu for ur, Noto Naskh Arabic for ar/fa, in the app (:lang
  rules) and in PDFs (backend/helper/pdfFonts.js, used by the printed paper).
- Migration 1760000000500: users.language_preference (CHECK en/ur/ar/fa), resources.extraction_method.
  PUT /api/auth/me/language; selectors on login/signup (AuthLayout), top bar, home header and profile;
  sign-up and instructor-registered students get their language set.
- Emails (and the notification texts for section 6) are rendered from backend/locales/<lang>.json in the
  RECIPIENT's language with dir/lang/font, Intl dates; parity tested.
- The exam page speaks the exam's language during the attempt (getFixedT), independent of the UI language.
- OCR: fas.traineddata added (Tesseract eng+ara+urd+fas). OCR_GEMINI_FALLBACK=true sends page images to
  Gemini only when Tesseract output fails the quality check; the path used is logged and stored in
  resources.extraction_method. Fixed a crash: tesseract.js re-threw worker errors as uncaught exceptions on
  degenerate images (errorHandler added; per-image failures become "no text" -> clear 422).
- TRANSLATION_REVIEW.md lists terminology choices and uncertain strings.
- New env: OCR_GEMINI_FALLBACK. Tests: 220 (11 new backend i18n/OCR tests).

## Section 5 summary
- Migration 1760000000600: learning_reports (per attempt + language: study_plan JSONB + source ai/fallback, pdf
  BYTEA; student_id SET NULL so anonymised results keep their report) and practice_sessions.
- API (students, completed attempts only; 404 before submitting, so neither answers nor objectives can be seen
  early): GET /api/student-analytics/results/:id (raw/adjusted scores, accuracy incl. not-reached questions,
  time, per-objective breakdown, weak areas < 60%, difficulty path, review with objective per question);
  POST .../study-plan (AI plan in the student's language, grounded in the weak objectives' retrieved passages,
  hallucinated chunk ids dropped, cached per language, deterministic fallback from the backend catalog if the
  model fails); GET .../report.pdf (server Puppeteer, embedded Nastaliq/Naskh fonts, report + study plan, stored
  and reused, invalidated when the plan changes); POST .../practice and /practice/:id/check (ungraded).
- Removed dead endpoints /student-analytics/overview, /performance, /recommendations, /report and
  /assessment/:id(+/questions) with their model/validator/repository code; removed jsPDF (client report).
  The dashboard percentage now uses the stored raw percentage (counts not-reached questions).
- UI: /student/results/:assessmentId with stat tiles, objective accuracy bars (one hue, value printed, weak
  objectives flagged with icon + label), difficulty path step chart (correct = filled circle, not correct =
  hollow square; hover/focus tooltip, hidden data table, mirrored in RTL), weak areas, study plan with
  passages, practice quiz with instant feedback, report language picker + PDF download, full review.
- Tests: 234 (14 new) incl. a real Chromium render of an Urdu report.

## Section 6 summary
- Migration 1760000000700: groups (unique case-insensitive name), group_memberships, notifications (type + data,
  rendered by the client in the reader's language), users.deleted_at.
- Scope: admins list and manage only users who share a group with them (403 OUT_OF_SCOPE otherwise) and still
  only between student and instructor; the super admin manages all groups/members and can set any role.
  /api/groups: list (own groups unless super admin), members, create/rename/delete, add members by email
  (unknown emails reported), remove member.
- POST /api/assessments/:id/enroll-group: enrolls every student of a group the requester belongs to; already
  enrolled students skipped; each new one is emailed and notified.
- Notifications (in-app + email in the recipient's language): role change, password change, enrollment (single
  and group), published (all enrolled students, when the pool is ready), results ready (exactly once, when the
  attempt actually completes). Account deletion: email only.
- Deletion anonymises instead of deleting: name/email/password/sign-in removed, enrollments, memberships,
  notifications and practice sessions removed, attempts and results kept as anonymous records; old tokens stop
  working and the user disappears from lists.
- UI: notification bell in the top bar (unread badge, panel, mark read / all, links), Groups page (super admin
  manages; admins read-only), "Enroll a whole group" on the enroll page, Groups in admin/super admin navigation.
- Phase 1 RBAC test "admin can move users" migrated: the admin must now share a group with the student.
- Tests: 243 (9 new institutions tests + migrated RBAC test).

## Section 7 summary
- Migration 1760000000800: assessments.negative_marking (default true), CHECK question_blocks.duration_per_question
  >= 30 s (older rows below it are raised to 30 first), index for the library listing.
- Printing: services/paper/paperSets.js + paperRender.js replace helper/Pdfkitgenerator.js. Modes: same paper for
  everyone, or up to 40 different papers (A, B, C...; Phase 1 assessments without a pool: up to 5) drawn from the
  pool with the same blueprint and no identical sets; one combined answer key at the end. PDF (Chromium, RTL
  fonts) or DOCX (`docx`). Header values (institute, teacher, subject) are printed exactly as typed, never sent
  to the LLM.
- Negative-marking toggle per assessment: when off, every planned negative mark is 0 at start (snapshot), so it
  cannot change mid-attempt.
- Links: helper/linkIngest.js fetches web pages (Readability via jsdom) and YouTube captions. SSRF guard: http(s)
  only, DNS-resolved address must be public (private, loopback, link-local, metadata ranges refused), checked
  again on each redirect; max 3 redirects, 10 s, 3 MB, HTML/plain text only. Links that cannot be read are
  reported back (`skippedLinks`) and never block saving.
- Library: content-hash dedupe per owner (duplicate upload/link returns the existing resource, flagged
  `duplicate`); GET /api/resources/search (text, type, visibility, language, pagination); UI rewritten with
  search, filters, pagination, "add link", duplicate notice.
- Instructor insights: GET /api/instructor-analytics/assessment/:id/insights (per-objective accuracy, hardest
  objectives, score distribution in 10% bands, median, difficulty reached final/highest) and /export?format=csv|xlsx
  (UTF-8 BOM CSV; exceljs; cells starting with = + - @ are prefixed to block formula injection).
- Super admin: GET /api/admin/stats?days=N (users, attempts, pool size, published assessments, LLM calls, failures,
  tokens, latency, estimated cost by model and purpose). Prices from config/llmPricing.js, overridable with
  LLM_PRICES_JSON; models without a price are listed as unpriced, never guessed.
- "Show live score" was already done in section 3.
- Tests: 257 (14 new in srs.test.js).

## Final verification summary
- lint (incl. i18n check), i18n:check, build, tests: all pass (259 tests). Log: docs/phase2-evidence/checks.log.
- Screenshots: 15 new/changed pages x 360/768/1280 x en/ur/ar = 135, on a demo stack (throwaway Docker DB, test
  fakes for LLM/email/embeddings, production build). Automatic checks: page overflow, elements outside the
  viewport, document dir, raw i18n keys, unlabeled controls, touch targets (< 44 px; 24 px for inline links and
  boxes), console errors, failed API calls. Final run: 135/135 clean. Fixed on the way: PageHeader actions
  overflowing at 768; print dialog opening in English for non-English users; English exam inside an RTL UI
  using the Urdu font and number format; a timed-out exam's result shown in English instead of the exam
  language; link touch targets under 44 px; "null" model name in platform stats.
- Live smoke test with the real keys (values never read or printed): 9 objectives, 10 valid questions each in
  English and natural Urdu, 8 LLM calls, about 7,700 input + 6,000 output tokens, 25 s.
- Gate 2: 6/6 pass (docs/phase2-evidence/gate2/gate2.log).
- Gap found and closed: the PDF report now contains practice questions with answers (SRS item 5.5).
- Dependencies: vulnerable pins inside office-text-extractor (mammoth directory traversal, js-yaml, fflate)
  patched with scoped npm overrides in the same majors; DOCX extraction regression test added.

## Decisions
- D0.1 npm audit majors NOT applied (risk noted): firebase (frontend; vulnerable firestore/grpc code is never
  imported, only firebase/auth), jest/nodemon (dev-only; npm suggests downgrades), office-text-extractor 4
  (moderate zip parsing; evaluate in section 1 with a DOCX fixture), @xenova/transformers (critical protobufjs
  in the onnx-web path; migrate to @huggingface/transformers in section 1 and verify embeddings match),
  jspdf (critical; to be removed in section 5 when reports move to server-side Puppeteer).
- D0.2 pg-boss only de-duplicates by singletonKey with policy "stately"; such jobs must be enqueued with a
  key (enforced) so keyless jobs never silently collapse into one slot.
- D0.3 One usage-log row per provider attempt (a failed primary + successful fallback = 2 rows), so cost
  reflects what was actually billed.

- D1.1 Objectives are written in the material's main language (English if mixed/none); questions are generated
  natively per student language from the same objectives and passages.
- D1.2 Changing an assessment's material re-extracts objectives and discards manual objective edits (they
  described the old material). Block-only changes keep them.
- D1.3 Re-chunking replaces chunk ids; source_chunk_ids on old objectives may then point to nothing. They are
  only hints (always filtered against the assessment's current chunks), so nothing breaks.
- D1.4 Every objective gets at least one question when the total allows, taken from the largest share, so
  no objective is silently untested.
- D1.5 Leak check only flags answers of >= 12 characters found verbatim in the stem; short answers ("Paris",
  "4") can legitimately appear in other words of a question.

- D2.1 Students may only start published (or publishing with their language ready) assessments. Phase 1
  assessments without objectives keep on-the-fly generation once published (existing executed ones were
  marked published by migration 200); drafts must go through objectives + publish.
- D2.2 Unapproved AI questions are served (they passed automatic validation); approval is a review marker.
  Requiring approval would block every exam on manual review of hundreds of questions.
- D2.3 Pool editing stays allowed after publishing (to fix a wrong question), always as a new version.
- D2.4 Fallback order favours fairness: same difficulty from the LLM first (bounded wait), a nearby difficulty
  only if that fails.

- D3.1 One engine and one API for every assessment (adaptive or not, pool or Phase 1). Fewer code paths means
  fewer integrity gaps; Phase 1 attempts in progress at deploy time continue (plan derived from their rows).
- D3.2 Missed windows (student offline) are "not reached", not auto-served: no question is revealed that the
  student never had a chance to answer, and marks still count in the total.
- D3.3 Adjusted % is normalised to medium difficulty (weight 1.0) and capped at 100 so it reads like a normal
  percentage; the raw % is always shown alongside (no student is told "100% correct = 85%").

- D4.1 No i18next plural keys: counts are phrased "Label: {{count}}" so Arabic (6 plural forms) and Urdu stay
  correct without per-language plural catalogs.
- D4.2 Non-English UIs show translated error codes instead of English server messages (losing some detail,
  e.g. which question block is invalid) rather than mixing languages.
- D4.3 The Gemini OCR fallback is opt-in because it sends the instructor's documents to a third party.

- D5.1 Practice questions are generated fresh per session and never stored in or drawn from the exam pool, so
  practice can never expose exam questions (to this or any other student).
- D5.2 Weak area = objective accuracy below 60% (WEAK_THRESHOLD); questions never reached count as not correct.
- D5.3 Study plan and report default to the student's account language, selectable per request.

- D6.1 An admin with no group manages nobody (scope fails closed).
- D6.2 Group management (create, membership) is super-admin only; admins only see their groups. This keeps an
  admin from widening their own scope.
- D6.3 Deleting an instructor keeps their assessments (shown as "Deleted user"); results must not vanish.

- D7.1 Printed papers count their questions as served (served_count + no identical sets), so a question that
  went home on paper is less likely to be served again online.
- D7.2 Header proper nouns are never translated (no LLM call); the old header-translation purpose is legacy.
- D7.3 The negative-marking switch is snapshotted at attempt start; changing it later never re-grades or alters
  running attempts.
- D7.4 Unreadable links are skipped with a visible report instead of failing the save; the instructor decides.
- D7.5 Link fetching refuses non-public addresses even if the instructor typed them (SSRF protection beats
  convenience for intranet pages).
- D7.6 Cost figures are labelled estimates; unpriced models are excluded and named, not filled with a guess.

- D8.1 After an attempt ends, the exam page keeps speaking the attempt's language (also after a reload), as
  during the attempt; the store no longer defaults it to English.
- D8.2 The PDF report's practice questions are the student's latest practice set in the report language, or
  a new set from the same generator. They are never exam-pool questions (D5.1), and the report is still
  produced if practice is unavailable.
- D8.3 The print dialog starts in the instructor's UI language; the paper language can still be changed.
- D8.4 Vulnerable pinned dependencies of office-text-extractor are patched with scoped npm overrides (same
  majors, DOCX regression test) instead of the breaking v4 upgrade.

- D9.1 Background jobs run inside the API process by default (JOBS_IN_API), so a single process is a complete
  server; a separate worker stays optional. Stuck work is re-queued on start and every 5 minutes.
- D9.2 Objectives are capped at the number of questions per student, so every objective is tested; when the
  model returns more, the highest-weighted are kept.
- D9.3 AI keys are chosen by remaining free quota (shuffled), never by cost; keys are identified by label only.
  Limits are configurable because free plans change and count per project/account.

## Open issues
- office-text-extractor 4 (major) still pending; file-type (moderate, ASF media parser) remains through it.
- firebase -> firestore/grpc advisories (high): firestore is never imported (only firebase/auth); npm's fix is
  a firebase downgrade, not applied. exceljs -> uuid (moderate): npm's fix is an exceljs downgrade, not applied.
- YouTube ingestion reads the caption tracks embedded in the watch page (there is no official transcript API).
  It is tested with a fake fetcher, not live.
- Urdu/Arabic/Persian strings need a native speaker's review (TRANSLATION_REVIEW.md).
- The frontend has no unit-test runner; UI behaviour is covered by the Puppeteer pass, lint and the i18n check.
- The Vite build warns about chunks over 500 kB (no code splitting yet).
- Secrets that were in the old repos' git history must be rotated (from the monorepo merge).

## Phase 3 temptations (noted, not built)
- Logging tab switches / focus loss during an exam (proctoring); the one-question engine would make it easy.
- Image-based questions from diagrams the OCR pipeline already sees.
- Matching questions in the question bank editor.
- Offline/PWA caching of the exam page (only the retry of unsaved answers exists).
- A live class view where the instructor watches progress as students answer.
- Polls / exit tickets built on the practice-quiz component.
- Per-institution usage limits or plans based on the LLM cost log (payments).
- Docker compose / deployment scripts for app + worker.
