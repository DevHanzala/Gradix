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
| 4. Full multilingual app | done | (this commit) |
| 5. Learning pathways | todo | |
| 6. Institutions, roles, notifications | todo | |
| 7. Remaining SRS features | todo | |
| Final verification + PHASE2_REPORT.md | todo | |

## Next
Section 5: learning pathways (results page: raw/adjusted, accuracy, time, per-objective bars, difficulty chart;
review with objective per question after submit; weak areas by objective; AI study plan in the student's
language with source passages; server Puppeteer PDF report persisted in learning_reports; ungraded practice quiz;
remove or wire the dead analytics endpoints). Note: /student/results/:id currently redirects to /student/analytics.

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

## Open issues
- office-text-extractor major upgrade still pending (D0.1).

## Phase 3 temptations (noted, not built)
