# Final status (after Phase 3)

Scored as strictly as `AUDIT.md` (read it with `git show 0004f0f^:AUDIT.md`): a feature is 100% only when it is built,
tested, checked in a browser and has no stated gap. "Not deployed yet" lowers the production items, not the features.

## SRS features F1–F11

| Feature | Audit | Phase 2 | **Phase 3** | Why not higher |
|---|---|---|---|---|
| F1 Unique AI questions | 55% | 90% | **92%** | Uncovered/uneven objectives now handled; YouTube refuses server-side transcripts (file fallback) |
| F2 Adaptive difficulty | 5% | 90% | **90%** | Thresholds still not tuned on real student data |
| F3 Multilingual + RTL | 55% | 85% | **86%** | Sindhi added but ~772 strings still English; Phase 3 strings machine-filled, not natively reviewed |
| F4 Print generation | 80% | 90% | **93%** | New types and images in PDF/DOCX; DOCX still depends on installed fonts |
| F5 Negative marking | 80% | 95% | **96%** | Defined for matching (only when nothing is right); nothing material missing |
| F6 Learning pathways | 40% | 90% | **91%** | New types in review and practice; study-plan quality checked with the fake AI only |
| F7 Roles | 50% | 90% | **92%** | Plans per user and group; no email-change feature (SRS 9.6) |
| F8 Minimal-input creation | 65% | 95% | **97%** | Objective count vs question count now checked at publish |
| F9 Security & session | 45% | 88% | **93%** | Light proctoring, windows, extra time added; JWT still has no refresh/revocation |
| F10 Resource library | 30% | 85% | **88%** | Originals kept in R2; dedupe exact-only, search text-only |
| F11 Analytics | 45% | 80% | **82%** | Live session results and integrity timelines; no per-question discrimination index |
| **Overall (unweighted)** | **≈ 50%** | **≈ 89%** | **≈ 91%** | |

## Phase 3 features

| Feature | Score | Why not higher |
|---|---|---|
| Live classroom (join by code/QR, guests, pacing, board, projector) | **92%** | Browser-checked incl. restart; not yet tried with a real class on Render |
| Engagement (game mode, polls, exit tickets, team race) | **90%** | Same; sounds/podium checked headless only |
| Question types (fill in the blank, matching, images) | **90%** | Browser-checked in exam/review/papers; bank editor image upload checked through the API, not by clicking |
| Proctoring and exam controls | **88%** | Light by design (no camera); a determined student can still use a second device |
| Help, accessibility, PWA | **85%** | 336-capture axe/overflow pass clean after one fix; read-aloud depends on the device having an Urdu/Arabic voice |
| Plans and usage limits | **80%** | No payment gateway; prices are placeholders to confirm |
| Production readiness (Render free tier) | **75%** | Ready on paper and measured locally (327 MB peak); not deployed, 512 MB container test not run |
| Load (200 concurrent) | **70%** | 0 errors at 200 and 400 on a local single-connection DB; not on Render's 0.1 CPU |
| Pilot kit and FYP documents | **90%** | `seed:demo` not run end to end |
| Storage (R2) | **90%** | Verified against S3Mock, not real R2 |

## Gap to Wayground (Quizizz) and Socrative

What Gradix now has that they treat as core: live sessions with code/QR join, guests, teacher- and student-pacing,
leaderboard, podium, team race, quick polls, exit tickets (Socrative's signature), projector view, reports with
CSV, printable papers, images in questions. What Gradix has that they do not: AI pools written natively in Urdu,
Arabic and Persian; a different but equivalent set per student; adaptive difficulty; objective-based study plans;
RTL throughout.

Still missing compared with them:

- **Content library**: no public bank of ready-made quizzes; every quiz starts from your own material.
- **Question types**: no ordering/sequencing, drag-and-drop, hotspot, math (equation) input, audio/video answers,
  open-ended with AI grading.
- **Game extras**: no power-ups, memes, music themes, avatars, homework/asynchronous game links with deadlines.
- **Integrations**: no Google Classroom / LMS (LTI) roster sync or grade passback; no SSO beyond Google sign-in.
- **Accommodations**: extra time exists; no per-student reduced options or read-aloud locked to the teacher's text.
- **Scale and maturity**: tested to 400 simulated users locally; they run millions of sessions, with mobile apps.
- **Payments**: plans exist, but there is no checkout.

## What you need to do (in order)

1. **Review and push** the `phase-3` branch (`git push -u origin phase-3`), open a pull request, and merge when CI is
   green. Nothing has been pushed.
2. **Rotate old secrets**: any key that was ever in a committed `.env` or shared in chat (Gemini, Groq, JWT,
   Firebase private key, SMTP password, Neon password) should be replaced before going public.
3. **Create the accounts** (free tiers): Cloudflare R2 (bucket + API token) and Brevo (API key, verified sender).
   Optional: Sentry.
4. **Deploy** with the Render Blueprint, following DEPLOYMENT.md step by step; set every variable listed in
   PHASE3_REPORT.md ("New environment variables"), with `EMBEDDING_PROVIDER=gemini`, `OCR_PROVIDER=gemini`,
   `STORAGE_DRIVER=r2`, `EMAIL_PROVIDER=brevo`.
5. **Run the migrations** on Neon: `npm run migrate` (eight new migrations). Then
   `npm run storage:migrate --workspace backend` to move cached reports into R2, and `npm run rechunk --workspace backend`
   so existing resources and pool questions are re-embedded with Gemini (same 384-dimension column).
6. Add your production address to **Firebase authorised domains** and **reCAPTCHA domains**, then click through
   Google sign-in once (firebase 13 was not tested in a browser).
7. **Seed the demo**: set `DEMO_PASSWORD` and run `npm run seed:demo`; rehearse DEMO_SCRIPT.md.
8. **Repeat the load test** against the deployed site with the k6 scripts in `docs/phase3-evidence/loadtest`
   (start at 50 users) and watch memory in the Render dashboard.
9. **Finish Sindhi** after the Gemini quota resets: `node backend/scripts/translateUi.js sd`.
10. Ask native speakers to review `docs/translation-review-{ur,ar,fa,sd}.md`.
11. Set up the free uptime monitor (DEPLOYMENT.md) so the server sleeps less before classes, and a weekly
    `npm run backup`.
