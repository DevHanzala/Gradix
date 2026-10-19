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

export const createAssessment = async (instructor, blocks = [{ type: "multiple_choice", count: 2, duration: 60, positive: 1, negative: 0 }]) => {
  const { rows } = await pool.query(
    `INSERT INTO assessments (title, prompt, instructor_id) VALUES ('Sample', 'General knowledge', $1) RETURNING *`,
    [instructor.id]
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
  aiAdapter.generate = async () => JSON.stringify(fakes.aiQuestions);
  mailer.send = async (message) => {
    sentEmails.push(message);
  };
  captchaVerifier.verify = async () => ({ success: true, score: 0.9 });
  firebaseVerifier.verifyIdToken = async (token) => {
    const decoded = fakes.verifiedTokens[token];
    if (!decoded) throw new Error("Firebase: invalid token");
    return decoded;
  };
  embeddingAdapter.embed = async () => Array.from({ length: 384 }, (_, i) => (i % 7) / 10);
  return fakes;
};

/** Emails are sent fire-and-forget; give them a tick to be captured. */
export const flushEmails = () => new Promise((resolve) => setTimeout(resolve, 20));
