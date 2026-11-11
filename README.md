# Gradix

Gradix is an integrity-first assessment and live-quiz platform for English, Urdu, Arabic and Persian classrooms.
An instructor uploads course material (PDF, Word, PowerPoint, text, images, web pages) and/or writes a short prompt.
Gradix then:

- extracts the **learning objectives** the material teaches;
- prepares a checked **question pool** in each language, written natively: multiple choice, true/false, short
  answer, **fill in the blank**, **matching**, with optional **images**;
- gives every student their **own question set** covering the same objectives the same number of times, served
  **one question at a time** with server-side timers, optional **adaptive difficulty** and **negative marking**;
- offers **light proctoring** (with the student's consent; no camera), **exam windows**, **extra time** and option
  shuffling;
- shows results **immediately**: per-objective scores, weak areas, an AI **study plan**, unlimited **practice** and a
  **PDF report** in the student's language;
- prints **papers** (PDF or Word, one for all or different per student, with an answer key);
- runs **live classroom sessions**: join by code or QR (guests welcome), teacher- or student-paced, real-time teacher
  board, projector view, **game mode**, **team race**, **quick polls** and **exit tickets**.

The interface works in English, Urdu, Arabic, Persian and Sindhi, with right-to-left layout for the last four. Roles:
**Super Admin**, **Admin** (manages the members of their groups), **Instructor**, **Student**; guests in live sessions.
Plans (Free / Pro / Institution) meter usage; the Super Admin assigns them.

| Folder | What it is |
|---|---|
| `backend/` | REST API, Socket.IO and background jobs: Node.js + Express, PostgreSQL with pgvector, pg-boss, Gemini/Groq, Cloudflare R2 (or local disk), Brevo/Resend email, Puppeteer PDFs |
| `frontend/` | Single-page app (installable PWA): React 19 + Vite + Tailwind CSS 4 + Zustand + react-i18next |
| `docs/` | Evidence of the Phase 3 checks, load-test scripts, quick-start guides (EN/UR, Markdown and PDF), translation review lists |

This is an npm workspaces monorepo: run the commands below from this folder (the repository root).

## Documents

| Document | For |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploying on Render + Neon + Cloudflare R2 + Brevo, step by step |
| [USER_MANUAL.md](USER_MANUAL.md) | Every feature, role by role |
| [DEMO_SCRIPT.md](DEMO_SCRIPT.md) | A 10-minute demo, with `npm run seed:demo` |
| [TRACEABILITY.md](TRACEABILITY.md) | SRS requirements → code → tests → status |
| `docs/quickstart/` | One-page guides for instructors and students (English, Urdu) |
| `PHASE3_REPORT.md`, `FINAL_STATUS.md` | What Phase 3 delivered, measurements, open issues |

---

## Local setup

Prerequisites: **Node.js 22.13+**, **PostgreSQL 14+ with pgvector** (a Neon database works; or
`docker compose -f backend/docker-compose.yml up -d db` for a local one on port 5433), and keys for Gemini
(Groq optional), Firebase (Google sign-in), reCAPTCHA v3, and an email provider (Gmail SMTP is fine locally).

```bash
cp backend/.env.example backend/.env       # fill in every value; each variable is described in the file
cp frontend/.env.example frontend/.env
npm install
npm run migrate                            # create/update the schema (only applies what is missing)
npm run create-super-admin --workspace backend
npm run dev                                # backend + frontend
```

Open **http://localhost:5173** (API on **http://localhost:5001**, health check `/api/health`). Locally files go to
`backend/storage/` (`STORAGE_DRIVER=local`), embeddings use the local model (`EMBEDDING_PROVIDER=local`) and OCR uses
Tesseract. Production uses R2, Gemini embeddings and Gemini OCR to stay under 512 MB (see DEPLOYMENT.md).

The backend refuses to start if a required variable is missing and names it. Never commit `.env` files.

---

## How it fits together

- **Background jobs** (objective extraction, question pools, re-chunking, re-embedding) are pg-boss jobs in Postgres,
  run inside the API process by default (`RUN_WORKER_IN_PROCESS=true`, one at a time in production). Unfinished work
  resumes after a restart.
- **Live sessions** keep all state in Postgres; Socket.IO only pushes changes, so a reload, a dropped connection or a
  server restart loses nothing. Correct answers leave the server only at reveal.
- **AI keys**: list Gemini keys in `GEMINI_API_KEYS` (comma-separated) and optionally `GROQ_API_KEY`. Calls rotate over
  the Gemini keys with free quota left; a key that returns a 429 cools down and the next one is tried, then Groq (text
  tasks only). The Super Admin dashboard shows usage per key against the free limits.
- **Files** are private and served through links that expire (5 minutes; question images 1 hour).
- **Email** goes through Brevo or Resend over HTTPS (Render's free tier blocks SMTP); Gmail SMTP for development.

---

## Tests and checks

```bash
npm test             # backend: Jest + Supertest (in-process PGlite with pgvector; all external services faked)
npm run lint         # ESLint (backend + frontend) and the translation check
npm run i18n:check   # translation check only
npm run build        # production build of the frontend
```

GitHub Actions runs all four on every push and pull request. `YOUTUBE_LIVE_TEST=true npm test -- tests/youtube.live.test.js`
runs the optional live YouTube test.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `dev:backend` / `dev:frontend` | Development servers |
| `npm run build` | Frontend production build |
| `npm run migrate` | Apply database migrations |
| `npm run seed` | Sample accounts for development |
| `npm run seed:demo` | Demo data for DEMO_SCRIPT.md (uses the real AI keys) |
| `npm run backup` / `npm run restore -- <key>` | Logical backup to storage / restore it |
| `npm run storage:migrate --workspace backend` | Move cached reports (and local files, `--copy-local`) into the configured storage |
| `npm run rechunk` | Re-process older resources |
| `npm run worker` | Optional separate job worker (with `RUN_WORKER_IN_PROCESS=false`) |

Developer tools: `node backend/scripts/translateUi.js <lang>` fills missing UI strings from English with Gemini (listed in
`docs/translation-review-<lang>.md` for native review); `node frontend/scripts/add-strings.mjs <file.json>` merges strings.

## Troubleshooting

- **"Reading your material…" never ends**: the log must show `[jobs] running … job type(s)` at startup; after 3 minutes
  the page offers **Try again**.
- **"Every AI key has reached its free daily limit"**: add keys from other Google accounts or wait for the reset time shown
  on the Super Admin dashboard. Published pools keep working.
- **Network errors in the browser**: `VITE_API_URL` must point at the API (ending in `/api`) and `FRONTEND_URL` must be the
  site's exact address (CORS).
- **"Waking up the server…"**: the free Render instance was asleep; requests retry by themselves for up to ~90 s.
