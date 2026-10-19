# Phase 2 progress

Branch: `phase-2` (from `main` at `d8ba9b9`). One commit per numbered section.
Resume rule: read this file, check `git log --oneline main..phase-2`, continue with "Next".

## Status

| Section | Status | Commit |
|---|---|---|
| 0. Prep (audit, pg-boss worker, LLM usage log) | done | 3266e49 |
| 1. Learning objectives + real RAG | done | (this commit) |
| 2. Question pool + pre-generation | todo | |
| 3. Adaptive difficulty engine | todo | |
| 4. Full multilingual app | todo | |
| 5. Learning pathways | todo | |
| 6. Institutions, roles, notifications | todo | |
| 7. Remaining SRS features | todo | |
| Final verification + PHASE2_REPORT.md | todo | |

## Next
Section 2: question pool (pre-generation on publish per objective x difficulty x language, validation +
regeneration, within/across-student uniqueness, top-up job, on-demand fallback, instructor question bank,
publishing progress, short-answer AI rubric).

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

## Open issues
- office-text-extractor major upgrade still pending (D0.1).

## Phase 3 temptations (noted, not built)
