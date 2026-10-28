# Gradix

Gradix is an AI-based assessment and learning platform. An instructor uploads course material (PDF, Word, PowerPoint, text, images, web pages or YouTube videos) and/or writes a short prompt. Gradix then:

- extracts the **learning objectives** the material teaches;
- prepares a checked **question pool** in English, Urdu, Arabic and/or Persian, written natively in each language;
- gives every student their **own question set** that covers the same objectives the same number of times;
- serves questions **one at a time**, optionally **adapting the difficulty** to the student's answers;
- shows the student **results immediately**: per-objective scores, weak areas, an AI **study plan**, ungraded **practice** and a downloadable **PDF report** in their language;
- lets the instructor **print papers** (PDF or Word, one paper for all or a different paper per student, with an answer key).

The whole interface works in English, Urdu, Arabic and Persian, with right-to-left layout for Urdu, Arabic and Persian. There are four roles: **Super Admin**, **Admin** (manages the users of their groups), **Instructor** and **Student**.

| Folder | What it is |
|---|---|
| `backend/` | REST API and background jobs: Node.js + Express, PostgreSQL with pgvector, pg-boss job queue, Gemini/Groq LLMs, local multilingual embeddings, Tesseract OCR, Puppeteer PDF |
| `frontend/` | Single-page app: React 19 + Vite + Tailwind CSS 4 + Zustand + react-i18next |

This is an npm workspaces monorepo: run every command below from this folder (the repository root).

---

## Prerequisites

- **Node.js 22.13 or newer** (`node -v`)
- **PostgreSQL 14+ with the [pgvector](https://github.com/pgvector/pgvector) extension.** A hosted Postgres such as **Neon** works (pgvector is available there). For a local database with Docker: `docker compose -f backend/docker-compose.yml up -d db` (Postgres 16 + pgvector on port 5433).
- Keys for the external services:
  - **Google Gemini** API key(s); **Groq** key(s) are optional. Free-plan keys are fine (see [AI keys and free limits](#ai-keys-and-free-limits)).
  - **Firebase** project with Google sign-in, plus a service account key for the backend
  - **Google reCAPTCHA v3** site key and secret
  - **Gmail** account with an app password, for sending email

Puppeteer downloads its own Chromium during `npm install`. On servers without it, set `PUPPETEER_EXECUTABLE_PATH`.

---

## Setup

```bash
# 1. Environment files (then fill in every value; each variable is described in the file)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Install both workspaces
npm install

# 3. Create or update the database schema (safe to run again; applies only what is missing)
npm run migrate

# 4. Optional: sample accounts (one per role) and a sample assessment
npm run seed
#    or, for production, only a super admin (password of 12+ characters):
npm run create-super-admin --workspace backend

# 5. Run the backend and the frontend together
npm run dev
```

Open **http://localhost:5173**. The API runs on **http://localhost:5001** (health check: `/api/health`).

Make sure the two apps point at each other:

- `frontend/.env`: `VITE_API_URL=http://localhost:5001/api` (the backend's port; `PORT` in `backend/.env` changes it)
- `backend/.env`: `FRONTEND_URL=http://localhost:5173`

The backend refuses to start if a required variable is missing, and the error names it. Never commit `.env` files (they are git-ignored).

Migrations are in `backend/migrations/` (one SQL file per change, applied in order and recorded in the `pgmigrations` table). Take a backup before migrating a production database; on Neon, create a branch first.

---

## How it works

**Instructor**

1. **Create** an assessment: title, optional prompt, source material (upload files, pick from the resource library, or add web/YouTube links) and question blocks (type, count, seconds per question, marks, negative marking).
2. **Objectives** are extracted automatically from the material (a few seconds; never more objectives than questions). Review them: edit, reorder, weight, add or delete.
3. **Publish** in the chosen languages. A question pool is generated and validated per objective, difficulty and language. Students can start as soon as their language is ready.
4. **Enroll** students one by one or a whole group, then follow the results: per-objective accuracy, hardest objectives, score distribution, difficulty reached, each student's answers, and CSV/Excel export.
5. **Print** a paper (PDF or Word), the same for everyone or different per student, with a combined answer key.

**Student**

- Chooses the exam language and answers one question at a time, each with its own timer. Answers are saved as they go, and refreshing the page resumes the exam.
- After submitting: score and difficulty-adjusted score, results per objective, weak areas, an AI study plan with the exact passages to re-read, unlimited ungraded practice, and a PDF report.

**Admins**

- The **Super Admin** manages every account and role, creates groups, and sees platform activity and AI usage.
- An **Admin** sees and manages only the members of their own groups.

---

## Background jobs

Objective extraction, question pools and re-processing of uploaded files run as background jobs in a pg-boss queue stored in the same Postgres database. **The backend process runs these jobs itself**, so one process is a complete server (`npm run dev` locally, `npm start --workspace backend` in production). Work interrupted by a restart is picked up again automatically.

To run jobs on a separate machine instead, start `npm run worker` there and set `JOBS_IN_API=false` on the API.

---

## AI keys and free limits

Add as many keys as you have in `backend/.env`:

```
GEMINI_CREATION_API_KEY_1=...
GEMINI_CREATION_API_KEY_2=...
GROQ_API_KEY=...
GROQ_API_KEY_2=...
```

- Each AI call goes to a randomly chosen key that **still has free quota today**. If a call fails, another key is tried.
- A key the provider rate-limits is paused: for a minute after a per-minute limit, or until its daily reset after a daily limit.
- Every call is logged with its key's label (for example `gemini-2`); the key itself is never stored or shown.
- The **Super Admin dashboard** shows AI requests and tokens used today, and for each key: requests and tokens used against its limit, what is left, its status and when it resets. It also shows a chart of tokens per day. No costs are shown.
- Default free limits:

  | Model | Requests per minute | Requests per day | Tokens per day | Daily reset |
  |---|---|---|---|---|
  | Gemini 2.5 Flash | 10 | 250 | no limit | midnight Pacific time |
  | Groq gpt-oss-20b | 30 | 1,000 | 200,000 | midnight UTC |

  Free limits change and apply per Google project or Groq account, so keys from different accounts add capacity. If your consoles show other numbers, set `LLM_FREE_LIMITS_JSON`, for example `{"gemini-2.5-flash":{"rpd":500}}`.

Embeddings run locally (a multilingual model of about 120 MB, downloaded once on first use), so they need no API key.

---

## Configuration reference

Every variable is listed with a description in `backend/.env.example` and `frontend/.env.example`. The optional ones you are most likely to change:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5001` | Backend port |
| `JOBS_IN_API` | `true` | Run background jobs in the backend process |
| `WORKER_CONCURRENCY` | `2` | Jobs processed in parallel |
| `LLM_FREE_LIMITS_JSON` | built-in free limits | Your plan's limits per model |
| `LLM_LOG_RETENTION_DAYS` | `365` | How long AI usage rows are kept |
| `POOL_ON_DEMAND_TIMEOUT_MS` | `20000` | Max wait for a question generated during an exam |
| `OCR_GEMINI_FALLBACK` | `false` | Send unreadable scanned pages to Gemini (sends documents to Google) |
| `EMBEDDING_MODEL` / `EMBEDDING_CACHE_DIR` | multilingual-e5-small | Local embedding model and its cache folder |

---

## Tests and checks

```bash
npm test             # backend: Jest + Supertest
npm run lint         # ESLint (backend + frontend) and the translation check
npm run i18n:check   # translation check only: missing keys, hard-coded text
npm run build        # production build of the frontend (frontend/dist)
```

Backend tests need no external services or keys. They start an in-process PostgreSQL (PGlite with pgvector), run the migrations, and replace the AI, email, reCAPTCHA, Firebase and embedding model with in-memory fakes. To use a real Postgres instead, set `TEST_PGHOST`, `TEST_PGPORT`, `TEST_PGDATABASE`, `TEST_PGUSER` and `TEST_PGPASSWORD`. To see the app's log output during tests, run `npm test -- --silent=false`.

UI text lives in `frontend/src/locales/<language>/<area>.json`; email and report text in `backend/locales/<language>.json`. Every key must exist in every language (the check fails otherwise).

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Backend and frontend together |
| `npm run dev:backend` / `npm run dev:frontend` | One app only |
| `npm run build` | Frontend production build |
| `npm run lint` / `npm test` / `npm run i18n:check` | Checks |
| `npm run migrate` | Apply database migrations |
| `npm run seed` | Sample data for development |
| `npm run rechunk` | Re-process older uploaded resources (also done automatically in the background) |
| `npm run worker` | Optional separate job worker (with `JOBS_IN_API=false`) |

Workspace-only scripts: `npm run migrate:down --workspace backend`, `npm run create-super-admin --workspace backend`.

---

## Troubleshooting

- **The objectives page keeps saying "Reading your material…"**: check that the backend log shows `[jobs] running … job type(s)` at startup and that `JOBS_IN_API` is not `false` (unless you run `npm run worker`). After 3 minutes the page offers **Try again**. The first extraction after installing can take a few minutes while the embedding model downloads.
- **"Every AI key has reached its free daily limit"**: all keys are used up for today. Add keys from other accounts or wait for the reset time shown on the Super Admin dashboard. Published question pools keep working.
- **The frontend shows network errors**: `VITE_API_URL` must match the backend's port, and `FRONTEND_URL` must match the frontend's address (CORS).
