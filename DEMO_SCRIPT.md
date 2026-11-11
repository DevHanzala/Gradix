# Gradix: 10-minute demo script

What the demo shows, in order: integrity-first exams with a **different question set for every
student**, **adaptive difficulty**, a full **Urdu right-to-left** experience, **light proctoring**,
**print papers** (PDF and Word), and the **live classroom** with game mode, polls and exit tickets.

## Before the demo (15 minutes earlier)

1. **Seed the demo data once** (from your computer, `backend/.env` pointing at the database, AI keys set):
   ```bash
   DEMO_PASSWORD='choose-a-12+-char-password' npm run seed:demo
   ```
   It creates the demo teacher and four students (`demo-teacher@gradix.demo`, `demo-ali`, `demo-sana` (Urdu),
   `demo-omar` (Arabic), `demo-zara`), the group "Demo Class 9-A", and "Photosynthesis check" (adaptive,
   MCQ + true/false + fill-in-the-blank + matching) published in English and Urdu. Re-run with `--reset` to start fresh.
2. **Wake the server**: open `https://<your-api>.onrender.com/api/health`. Wait until it shows `"status": "ok"`
   (database, storage and jobs all `ok`). The first call after sleeping can take up to a minute.
3. **Open the site** in three windows: teacher (laptop, projector), student Ali (phone or second browser),
   student Sana (incognito window, Urdu).
4. Check the Super Admin dashboard: the AI keys still have quota today (needed only for live AI quick sets).
5. Have a short PDF or text page ready to upload, in case you want to show creation live.

## The demo (10 minutes)

| Time | Show | Say |
|---|---|---|
| 0:00 | Landing page, switch language to **اردو** and back | "Gradix is built for Urdu and Arabic classrooms: every screen, email and PDF follows the student's language, right-to-left." |
| 0:45 | Teacher: **Photosynthesis check** > Objectives | "From one lesson file the AI found the learning objectives. Every student is tested on these same objectives in the same proportions." |
| 1:30 | Question bank (filter: Urdu) | "The questions are written natively in Urdu, not translated. Here are fill-in-the-blank and matching questions too." |
| 2:15 | Ali and Sana start the exam | "The pre-exam screen says exactly what is monitored. Nothing else: no camera." |
| 2:45 | Side by side: Ali's and Sana's first questions | "Different questions, same objectives: copying from a neighbour does not help." |
| 3:15 | Ali answers correctly a few times; difficulty badge rises | "Adaptive: right answers make the next question harder, wrong ones easier. The final score accounts for difficulty." |
| 4:00 | Sana switches tabs | "Leaving the tab is recorded and she is warned. The teacher can auto-submit after a set number of events." |
| 4:30 | Submit; results page, study plan, PDF report in Urdu | "Results are immediate: per-objective scores, the exact passages to re-read, unlimited practice, a PDF report in her language." |
| 5:30 | Teacher: Analytics, integrity column, timeline | "The teacher sees each objective, the hardest questions, and the integrity timeline." |
| 6:15 | Print: unique papers ×3, Urdu, PDF and Word | "For classes without devices: different printed papers with one answer key, in PDF or Word, right-to-left." |
| 7:00 | **Live sessions** > New: from the bank, game mode, 2 teams > projector view | "For class time: students join with this code or QR on their phones, even as guests." |
| 7:30 | Ali and Sana join; Start; answer; Show answer | "Answers stay hidden until I reveal them. Points for right and fast answers; the team race moves." |
| 8:30 | Quick poll, then exit ticket | "Polls and an end-of-lesson exit ticket, in the session's language." |
| 9:15 | Finish: podium | "Results are saved for analytics and CSV export." |
| 9:30 | Wrap up | "Unique questions, adaptive difficulty, Urdu RTL, integrity, print and live, in one free-to-run app." |

## If something goes wrong

* **"Waking up the server…"** stays more than 2 minutes: reload; check the Render logs.
* **Exam does not start** ("questions are being prepared"): the pool is still filling; use the other language or wait a minute.
* **Live AI quick set fails**: the AI keys are out of quota; use "From an assessment's question bank" instead.
* **Google sign-in fails**: use the email accounts from the seed.
