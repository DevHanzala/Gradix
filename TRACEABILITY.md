# Requirements traceability

Every SRS requirement mapped to the code that implements it, the tests that cover it, and its status.
Functional requirement IDs (FR-x.y) follow the SRS feature list as numbered in the original audit
(`git show 0004f0f^:AUDIT.md`, section 4). The SRS text itself is not in the repository, so the NFR titles
below are those used in the project briefs.

Status: **Done**, **Partial** (works, with a stated gap). Backend paths are under `backend/`, frontend paths
under `frontend/src/`. Tests are in `backend/tests/` (334 tests; browser evidence in `docs/phase3-evidence/`).

## Functional requirements

### FR-1 Unique AI questions per student
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-1.1 | PDF / DOC / link / YouTube / text prompt as source | `helper/textProcessor.js`, `helper/linkIngest.js`, `helper/resourceIngest.js` | ingest, srs ("YouTube link…", "unreadable link…"), youtube.live | Partial: YouTube refuses server-side caption downloads today; a clear message asks for the transcript as a file |
| FR-1.2 | Chunk, embed, store in a vector DB | `helper/chunker.js`, `helper/embeddingGenerator.js` (local or Gemini), pgvector HNSW (`migrations/…200`) | objectives ("chunking…", "retrieval…"), production ("re-embedded") | Done |
| FR-1.3 | Each student a different question set | `services/pool/pool.service.js` (`selectPoolQuestion`, `otherStudentSets`) | pool ("30 students → 30 distinct sets"), live ("unique questions per student") | Done |
| FR-1.4 | All sets map to the same objectives | `services/objectives.service.js`, `services/blueprint.js` | objectives ("blueprint…"), engine ("equal coverage") | Done |
| FR-1.5 | MCQ, extensible to other types | `utils/grading.js`, `services/questions/validation.js`: MCQ, true/false, short answer, fill in the blank, matching, images | grading, questionTypes | Done |
| FR-1.6 | Optional instructor prompt | `services/assessment.service.js`, `components/assessment/AssessmentForm.jsx` | objectives ("prompt-only assessment…") | Done |

### FR-2 Adaptive difficulty
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-2.1 | Track correctness and response time | `services/studentAssessment.service.js` (served_at, answered_at) | engine, exam | Done |
| FR-2.2 | Correct → harder | `services/engine/adaptiveConfig.js` | engine ("goes up…") | Done |
| FR-2.3 | Wrong/slow → easier | `services/engine/adaptiveConfig.js` | engine ("goes down…") | Done |
| FR-2.4 | Score accounts for difficulty | `computeScores` in `adaptiveConfig.js` | engine ("adjusted score…") | Done |
| FR-2.5 | Rolling performance window | `adaptiveConfig.js` (window of 3) | engine | Partial: thresholds not tuned on real student data |

### FR-3 Multilingual and RTL
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-3.1 | Language choice for instructor and student | `components/LanguageSwitcher.jsx`, `users.language_preference` | i18n, auth | Done |
| FR-3.2 | All UI text switches language | `i18n/index.js`, `locales/*` (en, ur, ar, fa, sd), `scripts/i18n-check.mjs` | i18n check in CI; screenshot checks | Partial: ur/ar/fa/sd strings added in Phase 3 partly machine-filled (docs/translation-review-*.md); Sindhi partly filled |
| FR-3.3 | Automatic RTL for ar/ur/fa | `<html dir>` in `i18n/index.js`, logical CSS | screenshot checks (live/engagement flows) | Done |
| FR-3.4 | Questions generated natively | `services/questions/generator.js` | pool ("native generation…") | Done |
| FR-3.5 | Islamic/Arabic religious texts as source | same ingestion and Arabic OCR (`assets/tessdata/ara`) | ingest | Done |
| FR-3.6 | Students choose different languages in one assessment | per-attempt language, pool per language | exam, learning | Done |

### FR-4 Print generation
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-4.1 | Printable version in a chosen language | `services/paper/paperSets.js`, `paperRender.js` | srs ("printed papers…") | Done |
| FR-4.2 | Full layout incl. RTL | `paperRender.js` (dir, Noto fonts) | srs, questionTypes ("print papers…") | Done |
| FR-4.3 | Custom header | `generatePhysicalPaperService` (never translated) | srs ("header printed exactly…") | Done |
| FR-4.4 | DOC and PDF export | `renderPaperDocx`, `renderPaperPdf` (images embedded) | srs, questionTypes ("images…") | Done |

### FR-5 Negative marking
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-5.1 | On/off per assessment | `assessments.negative_marking` | srs | Done |
| FR-5.2 | Configurable points and deductions | question blocks | grading | Done |
| FR-5.3 | Unanswered = 0 | `gradeAnswer` | grading ("unanswered scores zero") | Done |
| FR-5.4 | In live score and final report | `liveScoreOf`, results | exam ("live score…") | Done |

### FR-6 Learning pathways
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-6.1 | Immediate stats after submission | `services/learning/results.service.js` | learning | Done |
| FR-6.2 | Review with correct/incorrect highlighted | `components/assessment/AnswerReview.jsx` (partial state for matching) | learning, questionTypes | Done |
| FR-6.3 | Weak-area identification | `results.service.js` | learning | Done |
| FR-6.4 | Personalized recommendations with resources | `studyPlan.service.js` (source passages) | learning ("study plan…") | Done |
| FR-6.5 | Downloadable report | `report.service.js` (stored in R2) | learning, storage ("report…") | Done |
| FR-6.6 | Report in the student's language | `report.service.js` | learning ("Urdu report…") | Done |

### FR-7 Roles
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-7.1 | Four roles | `middleware/authMiddleware.js` | rbac | Done |
| FR-7.2 | Super Admin views all users, elevates roles | `services/auth.service.js`, `components/UserManagement.jsx` | rbac | Done |
| FR-7.3 | Super Admin deletes accounts + email | `auth.service.js` (anonymised results) | rbac, auth | Done |
| FR-7.4 | Admin manages only their own group | `services/group.service.js` | institutions | Done |
| FR-7.5 | Instructor: own assessments, enrollment, analytics | `services/assessmentAccess.js` | rbac, institutions | Done |
| FR-7.6 | Student sees only own data | `studentAnalytics`, `taking` routes | rbac, storage ("owner only") | Done |
| FR-7.7 | Email on role / critical changes | `helper/emailService.js` + `emailProviders.js` (Brevo/Resend/SMTP) | auth, email | Done |

### FR-8 Minimal-input creation
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-8.1 | Only title + resource or prompt required | `validator/assessmentInput.js` | ingest | Done |
| FR-8.2 | Optional targeted prompt | `AssessmentForm.jsx` | objectives | Done |
| FR-8.3 | Marking + time per question (min 30 s) | validator + DB CHECK | srs ("30-second minimum") | Done |
| FR-8.4 | Fully automatic processing | pg-boss jobs (`jobs/`), in the API process | jobs, objectives | Done |
| FR-8.5 | Editable before execution, locked after | `assessmentAccess.js` (`lockAfterExecution`) | ingest ("editing…") | Done |

### FR-9 Security and session
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-9.1 | One attempt per student; instructor owns material rights | unique attempt index; Terms of Service (`Pages/Legal.jsx`) | exam ("one attempt…") | Done |
| FR-9.2 | Per-question timer with auto-advance, server side | `studentAssessment.service.js` (deadlines) | exam, engine; load test timer drift p99 259 ms | Done |
| FR-9.3 | CAPTCHA on auth forms | `validator/verifyCaptcha.js` | auth | Done |
| FR-9.4 | JWT auth | `middleware/authMiddleware.js` | auth | Partial: no refresh-token or revocation |
| FR-9.5 | Email verification before access | `auth.service.js` | auth | Done |
| FR-9.6 | Notifications on password / role / email change | `services/notification.service.js` | auth, institutions | Partial: there is no email-change feature to notify about |

### FR-10 Resource library
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-10.1 | Shared reuse | `services/resource.service.js` (public/private, original file in R2) | ingest, storage | Done |
| FR-10.2 | De-duplication | content hash | srs ("dedupe…") | Partial: exact content only, not near-duplicates |
| FR-10.3 | Search / select existing | `searchResourcesService` | srs ("library search…") | Partial: text search, not semantic |

### FR-11 Analytics
| ID | Requirement | Implementation | Tests | Status |
|---|---|---|---|---|
| FR-11.1 | Instructor dashboard metrics | `services/insights.service.js`, `InstructorDashboard.jsx` | srs ("insights…") | Done |
| FR-11.2 | Per-question / per-objective analytics across students | `insights.service.js`, live per-question stats | srs, live | Partial: no item discrimination index per pool question |
| FR-11.3 | Per-student results (+ Super Admin stats) | `instructorAnalyticsRepository.js` (integrity count), `platformStats.service.js` | srs, aiKeys, examControls | Done |

## Non-functional requirements

| ID | Requirement | Implementation | Evidence | Status |
|---|---|---|---|---|
| NFR-1 | Performance (responsive under class-size load) | indexes, pool pre-generation, on-demand concurrency limit, throttled live board | load test: 200 students 0 errors; live push p95 110 ms (`docs/phase3-evidence/loadtest/results.md`) | Partial: measured on a single-connection local DB; not yet on Render's 0.1 CPU |
| NFR-2 | Timer accuracy under 1 s | server deadlines | load test drift p99 259 ms (200 users), 401 ms (400 users) | Done |
| NFR-3 | Scalability to 200 concurrent users | stateless API, state in Postgres, queue | load test 200 and 400 users, 0 errors | Partial: free tier's CPU is the open question |
| NFR-4 | Security (auth, roles, secrets, rate limits) | helmet, CORS, rate limiters, RBAC, signed file links, no answers before submit/reveal | auth, rbac, storage, live ("token never a login") | Done |
| NFR-5 | Availability / resilience | jobs and live sessions survive restarts, graceful shutdown, health check, backups | live ("survives restart"), liveFlow 14/14, production (backup round trip) | Done |
| NFR-6 | Usability / accessibility | design system, keyboard, read aloud, dyslexia font, low-bandwidth, PWA, tour, help | 336 captures (28 pages × 360/768/1280 × en/ur/ar/sd), axe-core WCAG 2 A/AA: 0 serious or critical (`docs/phase3-evidence/visual-check`) | Partial: automated checks only; no test with screen-reader users |
| NFR-7 | Localization (en/ur/ar/fa, RTL) | i18n catalogs, Noto fonts in app/PDF/DOCX | i18n check, engagementFlow (Urdu RTL) | Partial: native review pending |
| NFR-8 | Maintainability (tests, CI, docs) | 334 tests, GitHub Actions CI, README, DEPLOYMENT, USER_MANUAL | CI workflow | Done |
| NFR-9 | Privacy (minimal data, no camera, consent) | proctoring events only with consent, Sentry scrubbing, Privacy Policy, anonymised deletion | examControls, production ("Sentry events…") | Done |

## Built beyond the SRS
* Live classroom: join codes/QR, guests, teacher/student pacing, unique questions, projector view, CSV (`services/live/`).
* Engagement: game mode (points, streaks, leaderboard, podium, sounds), team race, quick polls, exit tickets.
* Light proctoring with consent screen, integrity timeline, auto-submit; exam windows; extra time; option shuffling.
* Fill-in-the-blank, matching and image questions everywhere (exam, live, practice, print).
* Plans (Free/Pro/Institution) with metering and Super Admin assignment.
* AI key pool with per-key free-quota tracking and Groq fallback; Gemini embeddings/OCR for low memory.
* File storage on Cloudflare R2 with signed links; backups to R2 with tested restore.
* Email over HTTPS (Brevo/Resend), PWA, low-bandwidth mode, read aloud, dyslexia font, onboarding tour, help center,
  landing page, Terms/Privacy, in-app feedback, Sindhi interface, Sentry, request IDs, CI, Render Blueprint.
