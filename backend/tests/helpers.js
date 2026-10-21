import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import pool from "../DB/db.js";
import { aiAdapter } from "../services/ai/generateContent.js";
import { mailer } from "../helper/emailService.js";
import { captchaVerifier } from "../validator/verifyCaptcha.js";
import { firebaseVerifier } from "../config/firebaseAdmin.js";
import { embeddingAdapter } from "../helper/embeddingGenerator.js";

export { pool };

export const PASSWORD = "Passw0rdGood";
let passwordHash;

const TABLES = [
  "llm_usage_log",
  "practice_sessions",
  "learning_reports",
  "pool_language_state",
  "question_pool",
  "learning_objectives",
  "student_answers",
  "generated_questions",
  "assessment_attempts",
  "assessment_resources",
  "resource_chunks",
  "resources",
  "enrollments",
  "question_blocks",
  "assessments",
  "users",
];

export const resetDatabase = async () => {
  await pool.query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
};

export const createUser = async ({ name, role = "student", verified = true, email } = {}) => {
  passwordHash ??= await bcrypt.hash(PASSWORD, 4);
  const userName = name || `${role}-${Math.random().toString(36).slice(2, 8)}`;
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password, role, verified, provider)
     VALUES ($1, $2, $3, $4, $5, 'manual')
     RETURNING id, name, email, role`,
    [userName, email || `${userName}@test.io`, passwordHash, role, verified]
  );
  return rows[0];
};

export const auth = (user) =>
  `Bearer ${jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET)}`;

/**
 * A Phase 1-style assessment (no objectives). `status: "published"` makes it
 * startable by students through the legacy generator.
 */
export const createAssessment = async (
  instructor,
  blocks = [{ type: "multiple_choice", count: 2, duration: 60, positive: 1, negative: 0 }],
  { status = "draft" } = {}
) => {
  const { rows } = await pool.query(
    `INSERT INTO assessments (title, prompt, instructor_id, status) VALUES ('Sample', 'General knowledge', $1, $2) RETURNING *`,
    [instructor.id, status]
  );
  for (const b of blocks) {
    await pool.query(
      `INSERT INTO question_blocks (assessment_id, question_type, question_count, duration_per_question, num_options, positive_marks, negative_marks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [rows[0].id, b.type, b.count, b.duration, b.type === "multiple_choice" ? 4 : null, b.positive ?? 1, b.negative ?? 0]
    );
  }
  return rows[0];
};

export const enroll = (assessment, student) =>
  pool.query(`INSERT INTO enrollments (assessment_id, student_id) VALUES ($1, $2)`, [assessment.id, student.id]);

/** Move an attempt's clock into the past to simulate elapsed time. */
export const shiftAttemptTime = (attemptId, seconds) =>
  pool.query(
    `UPDATE assessment_attempts
     SET started_at = started_at - make_interval(secs => $2),
         current_question_started_at = current_question_started_at - make_interval(secs => $2)
     WHERE id = $1`,
    [attemptId, seconds]
  );

export const MCQ_QUESTIONS = [
  { question_type: "multiple_choice", question_text: "Capital of France?", options: ["A. Paris", "B. Rome", "C. Madrid", "D. Berlin"], correct_answer: "A" },
  { question_type: "multiple_choice", question_text: "2 + 2 = ?", options: ["3", "4", "5", "6"], correct_answer: "B. 4" },
  { question_type: "true_false", question_text: "The sky is blue.", options: null, correct_answer: true },
];

const SYNTH = {
  en: { stem: (n) => `Synthetic question number ${n} about the lesson?`, options: (n) => ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"].map((o) => `${o} ${n}`), answer: (n) => `Model answer ${n}`, keyword: "lesson" },
  ur: { stem: (n) => `سبق کے بارے میں سوال نمبر ${n} کیا ہے؟`, options: (n) => ["پہلا", "دوسرا", "تیسرا", "چوتھا", "پانچواں", "چھٹا"].map((o) => `${o} ${n}`), answer: (n) => `نمونہ جواب ${n}`, keyword: "سبق" },
  ar: { stem: (n) => `ما هو السؤال رقم ${n} عن الدرس؟`, options: (n) => ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"].map((o) => `${o} ${n}`), answer: (n) => `إجابة نموذجية ${n}`, keyword: "الدرس" },
  fa: { stem: (n) => `پرسش شماره ${n} درباره درس چیست؟`, options: (n) => ["یکم", "دوم", "سوم", "چهارم", "پنجم", "ششم"].map((o) => `${o} ${n}`), answer: (n) => `پاسخ نمونه ${n}`, keyword: "درس" },
};
let synthCounter = 0;

/** A valid question for a generator request (unique stem per call). */
export const syntheticQuestion = (request, language, chunkIds = []) => {
  synthCounter += 1;
  const n = synthCounter;
  const t = SYNTH[language] || SYNTH.en;
  const base = { question_type: request.question_type, difficulty: request.difficulty, question_text: t.stem(n), source_chunk_ids: chunkIds.slice(0, 2) };
  if (request.question_type === "multiple_choice") {
    const options = t.options(n).slice(0, request.num_options || 4);
    return { ...base, options, correct_answer: options[n % options.length] };
  }
  if (request.question_type === "true_false") return { ...base, options: null, correct_answer: n % 2 === 0 };
  return { ...base, options: null, correct_answer: { answer: t.answer(n), required_keywords: [t.keyword], min_required_match: 1 } };
};

/** Deterministic bag-of-words vector: texts sharing words are similar. */
export const fakeEmbedding = (text) => {
  const vector = new Array(384).fill(0);
  const words = String(text)
    .replace(/^(passage|query): /, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  for (const word of words) {
    let h = 0;
    for (const ch of word) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    vector[h % 384] += 1;
  }
  vector[383] += 0.01; // never the zero vector
  const norm = Math.hypot(...vector);
  return vector.map((v) => v / norm);
};

/** Roughly what the e5 tokenizer reports: ~1.9 tokens per word plus 2 specials. */
export const fakeTokenCount = (text) => Math.ceil(String(text).split(/\s+/u).filter(Boolean).length * 1.9) + 2;

/**
 * Replace every external service with an in-memory fake.
 * Returns the captured emails and lets tests change the AI output.
 */
export const installFakes = () => {
  const sentEmails = [];
  const fakes = {
    sentEmails,
    aiQuestions: MCQ_QUESTIONS,
    verifiedTokens: {},
  };
  // Purpose-aware fake LLM. Tests can override a purpose via fakes.ai[purpose].
  fakes.ai = {
    objective_extraction: (prompt) => {
      const chunkIds = [...prompt.matchAll(/\[chunk (\d+)\]/g)].map((m) => Number(m[1]));
      return JSON.stringify(fakes.aiObjectives(chunkIds));
    },
  };
  fakes.aiObjectives = (chunkIds) => [
    { text: "Explain how plants make food", description: "Photosynthesis inputs and outputs", source_chunk_ids: chunkIds.slice(0, 2), weight: 2 },
    { text: "Describe the role of chlorophyll", description: "Light absorption", source_chunk_ids: chunkIds.slice(0, 1), weight: 1 },
    { text: "Identify where photosynthesis happens", description: "Chloroplasts and leaves", source_chunk_ids: chunkIds.slice(-1), weight: 1 },
  ];
  fakes.prompts = [];
  fakes.ai.study_plan = (prompt) => {
    const objectiveIds = [...prompt.matchAll(/\[objective (\d+)\]/g)].map((m) => Number(m[1]));
    const chunks = [...prompt.matchAll(/\[chunk (\d+)\] \(objective (\d+)/g)].map((m) => ({ id: Number(m[1]), objective: Number(m[2]) }));
    return JSON.stringify({
      summary: "Focus on the weak objectives.",
      steps: objectiveIds.map((id) => ({
        objective_id: id,
        focus: `Review objective ${id}`,
        why: "Low accuracy",
        activities: ["Re-read the passages", "Practise questions"],
        source_chunk_ids: chunks.filter((c) => c.objective === id).map((c) => c.id).concat([999999]),
      })),
      encouragement: "You can do it.",
    });
  };
  fakes.ai.question_generation = (prompt) => {
    const request = prompt.match(/REQUEST_JSON: (.*)/);
    if (!request) return JSON.stringify(fakes.aiQuestions);
    const language = (prompt.match(/LANGUAGE: (\w+)/) || [])[1] || "en";
    const chunkIds = [...prompt.matchAll(/\[chunk (\d+)\]/g)].map((m) => Number(m[1]));
    return JSON.stringify(
      JSON.parse(request[1]).flatMap((r) =>
        Array.from({ length: r.count }, () => syntheticQuestion(r, language, chunkIds))
      )
    );
  };
  aiAdapter.generate = async (prompt, options = {}) => {
    fakes.prompts.push({ purpose: options.purpose, prompt });
    // Pool generation purposes share the question generator's fake (looked up at call time).
    const generatorPrompt = !fakes.ai[options.purpose] && String(prompt).includes("REQUEST_JSON:");
    const purpose = String(options.purpose || "").startsWith("pool_") || generatorPrompt ? "question_generation" : options.purpose;
    const responder = fakes.ai[purpose];
    if (responder) return responder(prompt, options);
    return JSON.stringify(fakes.aiQuestions);
  };
  mailer.send = async (message) => {
    sentEmails.push(message);
  };
  captchaVerifier.verify = async () => ({ success: true, score: 0.9 });
  firebaseVerifier.verifyIdToken = async (token) => {
    const decoded = fakes.verifiedTokens[token];
    if (!decoded) throw new Error("Firebase: invalid token");
    return decoded;
  };
  embeddingAdapter.embed = async (texts) => texts.map(fakeEmbedding);
  embeddingAdapter.countTokens = async (text) => fakeTokenCount(text);
  return fakes;
};

/**
 * Start an exam and move through every question without answering (the
 * engine serves one question at a time, so a full set exists only after
 * the student has gone through it). Returns { attemptId, result }.
 */
export const playThrough = async (app, request, assessmentId, student, language = "en") => {
  const started = await request(app)
    .post(`/api/taking/assessments/${assessmentId}/start`)
    .set("Authorization", auth(student))
    .send({ language });
  if (started.status !== 200) throw new Error(`start failed: ${started.status} ${JSON.stringify(started.body)}`);
  let current = started.body.data;
  for (let i = 0; i < current.totalQuestions; i++) {
    const next = await request(app)
      .post(`/api/taking/attempts/${started.body.data.attemptId}/advance`)
      .set("Authorization", auth(student))
      .send({ fromIndex: i });
    if (next.body.data.finished) return { attemptId: started.body.data.attemptId, result: next.body.data.result };
    current = next.body.data;
  }
  throw new Error("exam did not finish");
};

/** Emails are sent fire-and-forget; give them a tick to be captured. */
export const flushEmails = () => new Promise((resolve) => setTimeout(resolve, 20));
