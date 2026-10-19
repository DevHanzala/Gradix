# Phase 2 progress

Branch: `phase-2` (from `main` at `d8ba9b9`). One commit per numbered section.
Resume rule: read this file, check `git log --oneline main..phase-2`, continue with "Next".

## Status

| Section | Status | Commit |
|---|---|---|
| 0. Prep (audit, pg-boss worker, LLM usage log) | done | (this commit) |
| 1. Learning objectives + real RAG | in progress | |
| 2. Question pool + pre-generation | todo | |
| 3. Adaptive difficulty engine | todo | |
| 4. Full multilingual app | todo | |
| 5. Learning pathways | todo | |
| 6. Institutions, roles, notifications | todo | |
| 7. Remaining SRS features | todo | |
| Final verification + PHASE2_REPORT.md | todo | |

## Next
Section 1: re-chunking (200-250 tokens, 15% overlap, sentence/paragraph aware incl. Urdu/Arabic/Persian),
relaxed quality filter, objectives table + extraction job, objectives review UI + status flow,
blueprint, pgvector retrieval + index, question metadata (objective, difficulty, language, chunks, stem hash).

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

## Open issues

## Phase 3 temptations (noted, not built)
