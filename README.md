# Gradix

Gradix is an AI-based assessment and learning platform. Instructors create an assessment from a short prompt and/or source material (PDF, Word, PowerPoint, text, images). Each student then gets their **own AI-generated question set** in their chosen language (English, Urdu, Arabic or Persian), and negative marking is supported. Instructors can print a paper in any of those languages with full right-to-left layout. There are four roles: Super Admin, Admin, Instructor and Student.

The repository has two apps, each its own git repository:

| Folder | What it is |
|---|---|
| `backend_temp/` | REST API: Node.js + Express, PostgreSQL with pgvector, Gemini/Groq LLMs, Tesseract OCR, Puppeteer PDF |
| `frontend_temp/` | Single-page app: React 19 + Vite + Tailwind CSS 4 + Zustand |

> The `_temp` folder names are historical and will be renamed later.

---

## Prerequisites

- **Node.js 22.13 or newer** (required by `pdf-to-img`; check with `node -v`)
- **PostgreSQL 14+ with the [pgvector](https://github.com/pgvector/pgvector) extension.** The easiest way is Docker: `docker compose up -d db` inside `backend_temp/` starts Postgres 16 + pgvector on port 5433. A hosted Postgres such as Neon also works; enable the `vector` extension there.
- Accounts and keys for the external services:
  - **Google Gemini** API key(s) for question generation; Groq is optional as a fallback
  - **Firebase** project with Google sign-in enabled, plus a **service account key** for the backend
  - **Google reCAPTCHA v3** site key and secret
  - **Gmail** account with an **app password** for sending email

Puppeteer downloads its own Chromium on `npm install`. On servers without it, set `PUPPETEER_EXECUTABLE_PATH`.

---

## 1. Configure environment variables

```bash
cd backend_temp
cp .env.example .env      # then fill in every value
cd ../frontend_temp
cp .env.example .env      # then fill in every value
```

`backend_temp/.env.example` and `frontend_temp/.env.example` list every variable with a description. The backend refuses to start if a required variable is missing, and the error names it.

Never commit `.env` files; they are git-ignored.

## 2. Install dependencies

```bash
cd backend_temp && npm install
cd ../frontend_temp && npm install
```

## 3. Create the database schema

```bash
cd backend_temp
npm run migrate
```

This runs `migrations/*.sql` with node-pg-migrate. It creates the `vector` extension and every table, foreign key, index and constraint, starting from an empty database.

The first migration is written to be **safe on an existing pre-migration database** as well. It only adds missing tables, columns and indexes, and flags duplicate historical retakes as `superseded` (nothing is deleted). Take a backup before running it against production data anyway.

## 4. Seed sample data (optional)

```bash
# needs SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD and SEED_PASSWORD in backend_temp/.env
npm run seed
```

This creates one account per role: the super admin from `SUPERADMIN_EMAIL`, plus `admin@`, `instructor@` and `student@` at `SEED_EMAIL_DOMAIN` (default `example.com`). It also creates a sample prompt-based assessment with the student enrolled. Passwords come from your env and are never printed. Running it twice is safe.

For production, create only the super admin, with `npm run create-super-admin` (password of 12+ characters).

## 5. Run the apps

```bash
# terminal 1
cd backend_temp
npm run dev          # http://localhost:5000  (health check: /api/health)

# terminal 2
cd frontend_temp
npm run dev          # http://localhost:5173
```

Point `VITE_API_URL` at the backend (e.g. `http://localhost:5000/api`) and `FRONTEND_URL` at the frontend.

## 6. Tests and checks

```bash
cd backend_temp
npm test             # Jest + Supertest, 108 tests
npm run lint

cd ../frontend_temp
npm run lint
npm run build
```

**Backend tests need no external services.** They start an in-process PostgreSQL (PGlite, with pgvector), run the migrations, and replace the LLM, email, reCAPTCHA, Firebase and embedding model with in-memory fakes. To run them against a real Postgres instead, set `TEST_PGHOST`, `TEST_PGPORT`, `TEST_PGDATABASE`, `TEST_PGUSER` and `TEST_PGPASSWORD` (the database must exist and have pgvector available).

Add `--silent=false` to see the application's log output during tests: `npm test -- --silent=false`.

The OCR fixtures in `backend_temp/tests/fixtures` can be regenerated with `node tests/fixtures/generateFixtures.mjs`.

---

## Useful scripts (backend)

| Script | Purpose |
|---|---|
| `npm run dev` / `npm start` | Start the API (nodemon / node) |
| `npm run migrate` / `npm run migrate:down` | Apply / roll back migrations |
| `npm run seed` | Development sample data |
| `npm run create-super-admin` | Create the single super admin |
| `npm test` | Test suite |
| `npm run lint` | ESLint |

## Project documents

- `AUDIT.md`: the audit of the codebase before Phase 1
- `PHASE1_REPORT.md`: what Phase 1 changed, remaining issues and the Phase 2 backlog
