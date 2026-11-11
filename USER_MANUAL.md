# Gradix user manual

Gradix is an assessment and live-quiz platform for English, Urdu, Arabic and Persian classrooms. This manual
describes every feature, role by role. The interface is also available in Sindhi (machine-translated, under review).

Roles: **Student**, **Instructor**, **Admin** (manages the members of their groups) and **Super Admin**
(manages everything). A **guest** can take part in live sessions only, with a nickname.

---

## 1. Getting started (everyone)

### 1.1 Create an account and sign in
1. Open the site and choose **Create account** (or **Log in**).
2. Enter your name, email and a password (8+ characters with letters and numbers), or use **Continue with Google**.
3. Open the verification email and click the link. You can sign in after verifying.
4. Forgot your password? **Log in > Forgot password**, enter your email, follow the link.

New accounts are students. An instructor or admin role is given by the Super Admin (or an Admin for their group).

### 1.2 Language
* Use the language menu at the top (English, اردو, العربية, فارسی, سنڌي). Urdu, Arabic, Persian and Sindhi switch the
  whole interface to right-to-left. Your choice is saved to your account; emails and PDF reports use it too.

### 1.3 Help, tour, feedback and display settings
* The **?** button at the top opens: **Help center** (guides per role), **Replay the tour**, **Send feedback**
  (goes to the Gradix team with the page you were on), **Low-bandwidth mode** (no animations, lighter pages; suggested
  automatically on slow connections) and **Dyslexia-friendly font** (plainer font, wider spacing, for English text).
* A short tour opens the first time you sign in. **Skip** closes it; you can replay it any time.

### 1.4 Install as an app
On a phone, use the browser menu > **Add to Home screen** (Chrome) or **Share > Add to Home Screen** (Safari).
Gradix then opens like an app. It needs a connection; without one an offline page explains what to do.

### 1.5 Profile
**My profile**: change your name, language and password. Deleting an account (Super Admin) removes personal data;
results stay only in anonymous form.

---

## 2. Students

### 2.1 Your dashboard
Lists the exams your instructors enrolled you in, with status (not started, in progress, completed) and the exam window.

### 2.2 Taking an exam
1. Open the exam and choose the **question language** (only languages that are ready are offered).
2. Read the rules. If the exam is **monitored**, the screen lists exactly what is recorded (leaving the tab or window,
   leaving fullscreen, copy/paste/right-click attempts; never camera, microphone or screen). Tick **I have read this
   and agree** to start. Monitored exams open in fullscreen.
3. Questions come **one at a time**, each with its own timer. When the timer ends the next question opens by itself.
   You cannot go back.
4. Answer types:
   * **Multiple choice / True-false**: tap an option, or press **1-6** / **A-F** (1 or 2 for true/false).
   * **Short answer**: type a sentence.
   * **Fill in the blank**: type into each gap in the sentence.
   * **Matching**: for each item on the left, choose its match from the list.
5. Answers **save automatically** as you go. If your connection drops, they are saved again when it returns; if you
   reload the page you continue where you were.
6. **Read aloud** (when your device has a voice for the exam language) reads the question and options.
7. Copy, paste and right-click are blocked in exams. In a monitored exam, leaving it is recorded and you are warned;
   the instructor may have set automatic submission after a number of events.
8. You get **one attempt**. After the last question the exam is submitted.

If an exam has a window, it can only be started between its opening and closing times (shown in the exam's time
zone, Asia/Karachi by default), and possibly only within a number of minutes after opening. An exam already
running is never cut off by the window. Some students have **extra time** set by the instructor; it is applied
automatically.

### 2.3 Results, study plan, practice and report
* Right after submitting: score (raw and difficulty-adjusted), accuracy, time, results per learning objective,
  the difficulty path (adaptive exams) and your **weak areas**.
* **Review**: every question with your answer and the correct one (partly right matching questions are marked).
* **Study plan**: AI advice in your language with the exact passages of the course material to re-read.
* **Practice**: unlimited new questions on your weak objectives. Practice never changes your score.
* **Download report**: a PDF with all of the above and practice questions with answers, in your language.

### 2.4 Live quizzes
1. When your teacher shows a code or QR, open **Join live session** (or scan the QR).
2. Type the 6-digit code. Signed in: you join with your name. Not signed in: type a nickname (you join as a guest).
3. Wait for the teacher to start. Each question has a timer; tap your answer. Your answer is final.
4. In teacher-paced sessions the correct answer appears when the teacher reveals it; in student-paced sessions,
   right after you answer, and you move on with **Next question**.
5. Game mode shows points (faster correct answers earn more, streaks earn a bonus), a leaderboard and a final podium.
   In a team race your team's progress bar moves with every correct answer.
6. **Polls** and **exit tickets** appear at the top of your screen; answer once. Anonymous polls hide your name
   from the teacher.
7. If you reload or lose the connection, open the same page again: you continue at the current question.

---

## 3. Instructors

### 3.1 Dashboard
Your assessments, recent results and your **plan usage** (new assessments this month, students, AI questions,
storage). Limits only stop new work; a running exam is never stopped.

### 3.2 Resource library
**Resources**: upload PDF, Word, PowerPoint, text and images (scans are read with OCR), or add a web page or a
YouTube link (YouTube only when the video's transcript can be read; otherwise paste the transcript as a text file).
Identical material is detected and not stored twice. Search by title or content and filter by type, language and
visibility. **Original file** downloads what you uploaded (through a short-lived private link). Public resources can be
used by other instructors.

### 3.3 Create an assessment
1. **New assessment**: title and (optional) prompt describing what to test.
2. Source material: upload files, pick from the library, and/or add links. A prompt alone also works.
3. **Question blocks**: for each block choose the type (multiple choice, true/false, short answer, fill in the blank,
   matching), how many questions, seconds per question (minimum 30), options (MCQ) or pairs (matching), marks for a
   correct answer and the deduction for a wrong one.
4. Options: **adaptive difficulty**, **show live score** to students, **negative marking** on/off.
5. **Save**. The assessment can be edited until students start it.

### 3.4 Learning objectives
Gradix extracts the learning objectives from the material in a few seconds (never more objectives than questions).
On the **Objectives** page edit, reorder, weight, add or delete them. Warnings tell you when an objective would get no
question or when coverage is uneven. The question plan shows how many questions test each objective.

### 3.5 Publish
Choose the languages (English, Urdu, Arabic, Persian) and **Publish**. A question pool is written natively in each
language and checked automatically. If an objective would get no question you must confirm. Students can start as
soon as their language is ready.

### 3.6 Question bank
Browse questions by objective, difficulty, language and type; **edit** (saves a new version), **regenerate** one,
**approve**, **retire**, or **add** your own. In the editor you can add an **image** to the question and to each
multiple-choice option (images are compressed; a description for students who cannot see it is required). Fill in
the blank: write `[[1]]`, `[[2]]` where the gaps go and one line of accepted answers per gap. Matching: write the
pairs and choose whether each correct pair earns partial credit.

### 3.7 Enroll students
**Enroll**: by email one by one, or a whole group at once. **Register student** creates a student account for you.

### 3.8 Exam controls
On the assessment page, **Exam controls**:
* **Proctoring**: off, record events only, record and warn the student, or record, warn and auto-submit after N events.
* **Exam window**: opening and closing time, latest start after opening, time zone shown to students.
* **Shuffle options** of multiple-choice questions for each student.
* **Extra time** per enrolled student (×1.25, ×1.5, ×2, ×3).
Changes apply to attempts that start afterwards.

### 3.9 Analytics
Per assessment: accuracy per objective, hardest questions, score distribution, difficulty reached, every student's
answers, the **integrity** column (number of recorded events, auto-submitted) with a timeline per attempt, and export
to CSV or Excel.

### 3.10 Print papers
**Print**: language, PDF or Word, one paper for everyone or a different paper per student (A, B, C…), header (institute,
teacher, subject, date, time, notes, printed exactly as typed) and font sizes. A combined answer key closes the
document. Fill-in-the-blank gaps print as lines, matching as two columns, images are included.

### 3.11 Live sessions
1. **Live sessions > New live session**: questions from an assessment's bank (same for everyone, or different for each
   student) or a quick AI set on a topic; language; number of questions; seconds per question; teacher-paced or
   student-paced (with a time limit); settings: game mode, leaderboard, sounds, anonymous names, teams (2-6).
2. Show the **code and QR** (or open the **projector view** in a second window).
3. Watch who joins; remove a participant if needed; move students between teams.
4. **Start**. During each question you see who answered, the answer distribution and students who may need help.
   **Pause/Resume**, **Show answer**, **Next question**. The question closes by itself when everyone has answered or
   the time is up.
5. **Quick poll** (one choice, several choices, short text; optionally anonymous) and **exit ticket** (understanding
   1-5, one thing learned, one question for you) can be launched at any time; results update live.
6. **End session**. Results stay in your list of sessions; **Export CSV** gives one row per student and question.

---

## 4. Admins
* **Users**: the members of your groups; change a member's role between student and instructor.
* **Groups**: see your groups and their members. Only the Super Admin creates groups and changes membership.

## 5. Super Admin
* **Users**: every account; change any role; delete accounts (personal data removed, results kept anonymously; the
  user is emailed).
* **Groups**: create groups, add members, assign group admins.
* **Platform stats and AI usage**: users by role, assessments, attempts; AI requests and tokens today per key, against
  the free limits, with each key's status and reset time; tokens per day.
* **Plans and usage**: assign Free, Pro or Institution to an instructor or a whole group (a user gets the better of the
  two) and see each instructor's usage.
* **Feedback and messages**: in-app feedback and contact-form messages; mark them read or done.

## 6. Privacy and integrity in short
* Students never receive correct answers before submitting (exams) or before the reveal (live sessions).
* Timers are kept by the server; each student has one attempt.
* Proctoring records only the listed events, only when the instructor turns it on.
* Files are private and opened through short-lived links. See **Privacy Policy** and **Terms of Service** (footer).
