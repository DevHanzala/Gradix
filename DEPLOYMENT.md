# Deploying Gradix (Render + Neon + Cloudflare R2 + Brevo)

This guide takes you from zero to a running pilot. It assumes no prior experience with these services.
Everything here works on free plans; the last section says what to upgrade first.

| Piece | Service | Free plan limits that matter |
|---|---|---|
| API (Node) | Render Web Service | 512 MB RAM, sleeps after 15 min idle, SMTP blocked |
| Website | Render Static Site | none that matter |
| Database | Neon (Postgres + pgvector) | 0.5 GB storage |
| Files | Cloudflare R2 | 10 GB storage, no egress fees |
| Email | Brevo | 300 emails/day |
| AI | Google Gemini (+ optional Groq) | per-key daily limits (shown in the Super Admin dashboard) |

You will need: a GitHub account with the Gradix repository, and about an hour.

---

## 1. Database: Neon

1. Sign up at <https://neon.tech> and create a project (region close to your users, e.g. Singapore).
2. In **Connection Details**, choose **Direct connection** (the host WITHOUT `-pooler`). The job queue
   needs a direct connection.
3. Note `host`, `database`, `user` and `password`. These become `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.
4. pgvector is available on Neon; the first migration enables it.

### Run the migrations (from your computer)

```bash
# in gradix/backend/.env set the four PG* values from Neon (leave PGSSLMODE empty: Neon needs SSL)
npm ci
npm run migrate
```

Run `npm run migrate` again after every update that adds a migration (it only applies what is missing).
Before migrating a database with real data, make a Neon branch (Neon > Branches > Create) as a safety copy.

### Create the Super Admin

```bash
npm run create-super-admin --workspace backend
```

It asks for a name, email and a password of 12+ characters. Use this account to assign roles and plans.

---

## 2. File storage: Cloudflare R2

1. Sign up at <https://dash.cloudflare.com>, open **R2** and enable it (a card is asked for; the free tier is not charged).
2. **Create bucket**: name it e.g. `gradix-files`, location Automatic. Keep it **private** (no public access).
3. **Manage R2 API Tokens > Create API token**: permission **Object Read & Write**, limited to this bucket.
4. Copy the **Access Key ID** and **Secret Access Key** (shown once) and your **Account ID** (right side of the R2 page).

These become `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID` and `R2_BUCKET`.
Files are never public: Gradix hands out links that expire after 5 minutes (images: 1 hour).

---

## 3. Email: Brevo

Render's free tier blocks SMTP, so Gradix sends email over Brevo's HTTPS API.

1. Sign up at <https://www.brevo.com> (free plan).
2. **Senders, Domains & Dedicated IPs > Senders > Add a sender**: use an address you can open
   (e.g. your Gmail). Brevo emails a confirmation link; click it. No domain is needed.
3. **SMTP & API > API Keys > Generate a new API key**. Copy it.

These become `BREVO_API_KEY` and `EMAIL_FROM` (the verified address). `EMAIL_PROVIDER=brevo`.

---

## 4. AI keys

* Gemini: <https://aistudio.google.com/apikey> > Create API key. Keys from **different Google accounts or
  projects** add capacity; two keys of one project share one quota.
* Groq (optional fallback for text tasks): <https://console.groq.com/keys>.

Put all Gemini keys in `GEMINI_API_KEYS`, separated by commas, and the Groq key in `GROQ_API_KEY`.
In production Gemini also does embeddings and OCR (`EMBEDDING_PROVIDER=gemini`, `OCR_PROVIDER=gemini`),
which keeps the server under 512 MB.

---

## 5. Render: create both services from the Blueprint

1. Sign up at <https://render.com> with GitHub and allow access to the Gradix repository.
2. **New + > Blueprint**, pick the repository. Render reads `render.yaml` and proposes two services:
   `gradix-api` (Web Service) and `gradix` (Static Site).
3. Render asks for every value marked `sync: false`. Fill them in (table below). `JWT_SECRET` is generated for you.
4. Click **Apply**. The first build of the API takes 5-10 minutes (it downloads Chromium for PDFs).
5. When `gradix-api` is live, open `https://gradix-api.onrender.com/api/health` (your URL may differ). You
   should see `"status": "ok"` with database, storage and jobs all `ok`.
6. Copy the two URLs and finish the values that refer to each other:
   * on **gradix-api**: `FRONTEND_URL` = the static site URL (no slash at the end);
   * on **gradix**: `VITE_API_URL` = the API URL + `/api`.
   Changing a `VITE_…` value needs a redeploy of the static site (it is built into the bundle).

If you prefer to create the services by hand: API build command `npm ci`, start command
`npm start --workspace backend`, health check path `/api/health`, root directory empty; static site build
command `npm ci && npm run build --workspace frontend`, publish directory `frontend/dist`, and a rewrite
rule `/*` → `/index.html`.

### Environment variables (API)

| Variable | Value |
|---|---|
| `NODE_VERSION` | `22.20.0` (set by the Blueprint) |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` (real client IPs behind Render's proxy, for rate limits) |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Neon direct connection; port `5432` |
| `FRONTEND_URL` | the static site URL, e.g. `https://gradix.onrender.com` (CORS and links in emails) |
| `JWT_SECRET` | long random string (generated) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Firebase service account (Google sign-in). Paste the private key with its `\n` sequences as in the JSON file |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA v3 secret |
| `GEMINI_API_KEYS` | comma-separated Gemini keys |
| `GROQ_API_KEY` | optional |
| `EMAIL_PROVIDER` | `brevo` |
| `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME` | Brevo key, verified sender, display name |
| `STORAGE_DRIVER` | `r2` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | from step 2 |
| `RUN_WORKER_IN_PROCESS` | `true` (background jobs run inside the API) |
| `WORKER_CONCURRENCY` | `1` (one job at a time on 512 MB) |
| `EMBEDDING_PROVIDER` | `gemini` |
| `OCR_PROVIDER` | `gemini` (Tesseract is the fallback) |
| `SENTRY_DSN` | optional, error monitoring |
| `LLM_FREE_LIMITS_JSON` | optional, your plan's AI limits if they differ from the defaults |

Do **not** set `PORT` (Render sets it) or `PGSSLMODE` (Neon needs SSL).

### Environment variables (static site)

| Variable | Value |
|---|---|
| `VITE_API_URL` | API URL + `/api`, e.g. `https://gradix-api.onrender.com/api` |
| `VITE_FIREBASE_*` | the six values from Firebase > Project settings > Your apps (web) |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key |
| `VITE_SENTRY_DSN` | optional |

---

## 6. Firebase and reCAPTCHA domains

* Firebase console > Authentication > Settings > **Authorized domains** > add your static site domain
  (e.g. `gradix.onrender.com`). Without it Google sign-in fails.
* reCAPTCHA admin (<https://www.google.com/recaptcha/admin>) > your site > **Domains** > add the same domain.
  Without it login and signup fail.

---

## 7. Keep the free API awake (optional but recommended)

The free API sleeps after 15 minutes without requests; the next visitor waits 30-60 seconds (Gradix shows
"Waking up the server…" and retries by itself). For class time, keep it awake:

1. Sign up at <https://uptimerobot.com> (free).
2. **Add New Monitor**: type HTTP(s), URL `https://gradix-api.onrender.com/api/health`, interval 5 minutes.

Render's free plan gives 750 instance hours a month, enough for one always-on service. Background jobs
resume after a sleep or restart (their state is in Postgres), and exams and live sessions continue from
the database.

---

## 8. Logs, redeploys and problems

* **Logs**: Render > `gradix-api` > Logs. In production every request is one JSON line with a
  `requestId`; error responses carry the same `requestId`, so you can find the matching log line.
* **Redeploy**: every push to `main` redeploys both services. Manual: service > Manual Deploy.
  If PDFs fail with "Could not find Chrome": Manual Deploy > **Clear build cache & deploy**.
* **Health**: `/api/health` returns `ok`, `degraded` (storage or job queue problem, the site still works)
  or `down` (database unreachable, HTTP 503).

| Symptom | Fix |
|---|---|
| Browser shows CORS errors | `FRONTEND_URL` must equal the site URL exactly; `VITE_API_URL` must end in `/api` |
| Google sign-in fails | add the domain to Firebase authorized domains |
| Login/signup says reCAPTCHA failed | add the domain in the reCAPTCHA admin |
| No emails | check `BREVO_API_KEY`, and that `EMAIL_FROM` is verified in Brevo |
| "Every AI key has reached its free daily limit" | add keys from other Google accounts, or wait for the reset time shown on the Super Admin dashboard |
| Service restarts with "out of memory" | check `EMBEDDING_PROVIDER=gemini` and `OCR_PROVIDER=gemini`; otherwise upgrade (section 10) |

---

## 9. Backups and restore

1. **Neon (first line)**: Neon keeps a history of your database. Neon > Branches > Restore lets you go back
   to an earlier point in time (the free plan keeps a short history; paid plans longer).
2. **Your own copy**: from your computer, with `backend/.env` pointing at Neon and R2:

   ```bash
   npm run backup --workspace backend            # writes backups/gradix-<time>.ndjson.gz to R2
   npm run backup --workspace backend -- --list  # lists backups
   ```

   Run it before every migration and regularly (e.g. weekly).
3. **Restore** into an empty, migrated database (for example a new Neon branch):

   ```bash
   npm run migrate
   npm run restore --workspace backend -- backups/gradix-2026-11-11T09-00-00-000Z.ndjson.gz
   ```

   Add `--force` to replace the contents of a database that is not empty. The backup must come from the
   same schema version (the script checks this). The job queue is not backed up (it is rebuilt).

---

## 10. When the pilot needs more power: what to upgrade first

1. **Render API to Starter** (always on, no cold starts, SMTP allowed). Same 512 MB.
2. **Render API to Standard (2 GB)** if PDFs or OCR of large scans are slow or restart the service; you can then
   set `WORKER_CONCURRENCY=2`.
3. **Neon Launch plan** when the database passes about 400 MB or you need longer point-in-time restore.
4. **More Gemini capacity**: keys from more Google accounts, or a paid Gemini tier for heavy question generation.
5. A **separate background worker** (Render Background Worker running `npm run worker`, with
   `RUN_WORKER_IN_PROCESS=false` on the API) when publishing many large assessments at once.

The load test results in `PHASE3_REPORT.md` show how many concurrent students each setup handles.
