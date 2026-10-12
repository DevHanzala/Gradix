import bcrypt from "bcrypt";
import pool, { withTransaction } from "../DB/db.js";
import { requireEnv } from "../config/env.js";
import { validatePasswordStrength } from "../validator/user.validator.js";

/**
 * Development seed (`npm run seed`). Idempotent: running it twice changes nothing.
 *
 * Creates one verified user per role and a sample prompt-based assessment
 * with the sample student enrolled. Passwords come from the environment and
 * are never printed:
 *   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD   - the super admin
 *   SEED_PASSWORD                           - shared by the admin, instructor and student
 *   SEED_EMAIL_DOMAIN (optional)            - default "example.com"
 */
const fail = (message) => {
  console.error(`Seed refused: ${message}`);
  process.exit(1);
};

let superAdminEmail;
let superAdminPassword;
let seedPassword;
try {
  superAdminEmail = requireEnv("SUPERADMIN_EMAIL").trim().toLowerCase();
  superAdminPassword = requireEnv("SUPERADMIN_PASSWORD");
  seedPassword = requireEnv("SEED_PASSWORD");
} catch (error) {
  fail(error.message);
}
for (const [label, value] of [["SUPERADMIN_PASSWORD", superAdminPassword], ["SEED_PASSWORD", seedPassword]]) {
  const errors = validatePasswordStrength(value);
  if (errors.length) fail(`${label}: ${errors[0]}`);
}

const domain = (process.env.SEED_EMAIL_DOMAIN || "example.com").trim();
const users = [
  { name: process.env.SUPERADMIN_NAME?.trim() || "Super Administrator", email: superAdminEmail, role: "super_admin", password: superAdminPassword },
  { name: "Ayesha Admin", email: `admin@${domain}`, role: "admin", password: seedPassword },
  { name: "Imran Instructor", email: `instructor@${domain}`, role: "instructor", password: seedPassword },
  { name: "Sara Student", email: `student@${domain}`, role: "student", password: seedPassword },
];

const SAMPLE_TITLE = "Sample: Photosynthesis basics";
const SAMPLE_PROMPT =
  "Photosynthesis for grade 8: how plants use sunlight, water and carbon dioxide to make glucose and release oxygen; the role of chlorophyll and leaves.";

try {
  const summary = await withTransaction(async (client) => {
    const ids = {};
    let created = 0;
    for (const u of users) {
      const existing = await client.query("SELECT id, role FROM users WHERE LOWER(email) = LOWER($1)", [u.email]);
      if (existing.rows[0]) {
        ids[u.role] = existing.rows[0].id;
        continue;
      }
      const hash = await bcrypt.hash(u.password, 12);
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password, role, verified, provider)
         VALUES ($1, $2, $3, $4, TRUE, 'manual') RETURNING id`,
        [u.name, u.email, hash, u.role]
      );
      ids[u.role] = rows[0].id;
      created += 1;
    }

    let assessmentId;
    const existingAssessment = await client.query("SELECT id FROM assessments WHERE title = $1 AND instructor_id = $2", [
      SAMPLE_TITLE,
      ids.instructor,
    ]);
    if (existingAssessment.rows[0]) {
      assessmentId = existingAssessment.rows[0].id;
    } else {
      const { rows } = await client.query(
        `INSERT INTO assessments (title, prompt, external_links, instructor_id) VALUES ($1, $2, '[]'::jsonb, $3) RETURNING id`,
        [SAMPLE_TITLE, SAMPLE_PROMPT, ids.instructor]
      );
      assessmentId = rows[0].id;
      await client.query(
        `INSERT INTO question_blocks
           (assessment_id, question_type, question_count, duration_per_question, num_options, positive_marks, negative_marks, created_by)
         VALUES ($1, 'multiple_choice', 4, 60, 4, 1, 0.25, $2),
                ($1, 'true_false', 2, 30, NULL, 1, 0, $2)`,
        [assessmentId, ids.instructor]
      );
    }

    await client.query(
      `INSERT INTO enrollments (assessment_id, student_id) VALUES ($1, $2)
       ON CONFLICT (assessment_id, student_id) DO NOTHING`,
      [assessmentId, ids.student]
    );

    return { created, assessmentId };
  });

  console.log(`Seed complete: ${summary.created} new user(s); sample assessment id ${summary.assessmentId}.`);
  console.log(`Accounts: ${users.map((u) => `${u.role}=${u.email}`).join(", ")} (passwords from your env).`);
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  await pool.end().catch(() => {});
  process.exit(1);
}
