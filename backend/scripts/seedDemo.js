import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

/**
 * `npm run seed:demo`: data for the 10-minute demo (DEMO_SCRIPT.md).
 *
 * Creates (once; run again with --reset to rebuild):
 *  - instructor demo-teacher@<domain>, students demo-ali, demo-sana (Urdu), demo-omar (Arabic),
 *    demo-zara; all in group "Demo Class 9-A"; password from DEMO_PASSWORD (never printed);
 *  - a lesson on photosynthesis (English) in the resource library;
 *  - "Photosynthesis check" (adaptive, negative marking, MCQ + true/false + fill-in-the-blank +
 *    matching), objectives extracted and the pool generated in English and Urdu with the REAL AI
 *    keys (about 15-25 AI calls), the whole group enrolled, light proctoring (warn) on.
 * The instructor's plan is set to Pro so the demo never hits a Free limit.
 *   DEMO_PASSWORD (required, 12+ characters), DEMO_EMAIL_DOMAIN (default gradix.demo)
 */
const LESSON = `Photosynthesis is the process by which green plants make their own food.
It takes place mainly in the leaves, inside small structures called chloroplasts.
Chloroplasts contain chlorophyll, a green pigment that absorbs sunlight.
Plants take in carbon dioxide from the air through tiny pores called stomata.
They take in water from the soil through their roots; the water travels up the stem in the xylem.
Using the energy of sunlight, the plant turns carbon dioxide and water into glucose.
Oxygen is released into the air as a by-product.
The word equation is: carbon dioxide + water -> glucose + oxygen (in the presence of light and chlorophyll).
Glucose is used for energy in respiration, stored as starch, or used to build cellulose for cell walls.
The rate of photosynthesis depends on light intensity, carbon dioxide concentration and temperature.
If any one of these is in short supply, it limits the rate; this is called a limiting factor.
Without photosynthesis there would be no oxygen to breathe and no food chains on land.`;

const main = async () => {
  const password = process.env.DEMO_PASSWORD || "";
  if (password.length < 12) throw new Error("Set DEMO_PASSWORD (12+ characters) first.");
  const domain = (process.env.DEMO_EMAIL_DOMAIN || "gradix.demo").trim();
  const reset = process.argv.includes("--reset");

  const { default: db } = await import("../DB/db.js");
  const { queueAdapter } = await import("../jobs/queue.js");
  queueAdapter.mode = "inline"; // run extraction and pool generation right here, not in a worker
  const { createAssessmentService, enrollGroupService } = await import("../services/assessment.service.js");
  const { publishService } = await import("../services/pool/bank.service.js");
  const { updateExamSettingsService } = await import("../services/assessment.service.js");

  const email = (n) => `demo-${n}@${domain}`;
  const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [email("teacher")]);
  if (existing.rows[0] && !reset) {
    console.log("Demo data already exists. Run with --reset to rebuild it.");
    await db.end();
    return;
  }
  if (reset) {
    await db.query(`DELETE FROM groups WHERE name = 'Demo Class 9-A'`);
    await db.query(`DELETE FROM users WHERE email LIKE $1`, [`demo-%@${domain}`]);
  }

  const hash = await bcrypt.hash(password, 10);
  const mk = async (key, name, role, language) =>
    (
      await db.query(
        `INSERT INTO users (name, email, password, role, verified, provider, language_preference, plan)
         VALUES ($1, $2, $3, $4, TRUE, 'manual', $5, $6) RETURNING id, name, email, role`,
        [name, email(key), hash, role, language, role === "instructor" ? "pro" : "free"]
      )
    ).rows[0];
  const teacher = await mk("teacher", "Iqra Ahmed", "instructor", "en");
  const students = [
    await mk("ali", "Ali Raza", "student", "en"),
    await mk("sana", "ثنا خان", "student", "ur"),
    await mk("omar", "عمر فاروق", "student", "ar"),
    await mk("zara", "Zara Malik", "student", "en"),
  ];
  const group = (await db.query(`INSERT INTO groups (name, description, created_by) VALUES ('Demo Class 9-A', 'Demo group', $1) RETURNING id`, [teacher.id])).rows[0];
  for (const u of [teacher, ...students]) await db.query(`INSERT INTO group_memberships (group_id, user_id) VALUES ($1, $2)`, [group.id, u.id]);
  console.log("Accounts and group created.");

  const user = { id: teacher.id, role: "instructor" };
  const blocks = [
    { question_type: "multiple_choice", question_count: 4, duration_per_question: 60, num_options: 4, positive_marks: 2, negative_marks: 0.5 },
    { question_type: "true_false", question_count: 2, duration_per_question: 30, positive_marks: 1, negative_marks: 0.25 },
    { question_type: "fill_blank", question_count: 1, duration_per_question: 60, positive_marks: 2, negative_marks: 0 },
    { question_type: "matching", question_count: 1, duration_per_question: 90, num_options: 4, positive_marks: 3, negative_marks: 0 },
  ];
  const file = { originalname: "photosynthesis-lesson.txt", mimetype: "text/plain", size: LESSON.length, buffer: Buffer.from(LESSON) };
  console.log("Creating the assessment and extracting objectives (AI)...");
  const assessment = await createAssessmentService(
    { title: "Photosynthesis check", prompt: "Grade 9 biology: how plants make food", question_blocks: JSON.stringify(blocks), adaptive: "true", negative_marking: "true" },
    user,
    [file]
  );
  const state = (await db.query(`SELECT status FROM assessments WHERE id = $1`, [assessment.id])).rows[0];
  if (state.status !== "objectives_ready") throw new Error(`Objective extraction did not finish (status ${state.status}). Check the AI keys and try again with --reset.`);
  console.log("Publishing in English and Urdu (AI writes the question pool; this takes a minute)...");
  await publishService(assessment.id, user, ["en", "ur"], { allowUncovered: true });
  await enrollGroupService(assessment.id, group.id, user);
  await updateExamSettingsService(assessment.id, user, { proctoring: "warn", shuffleOptions: true });
  const languages = (await db.query(`SELECT language, state FROM pool_language_state WHERE assessment_id = $1`, [assessment.id])).rows;
  console.log(`Assessment ${assessment.id} ready: ${languages.map((l) => `${l.language}=${l.state}`).join(", ")}`);
  console.log(`Demo accounts: ${[teacher, ...students].map((u) => u.email).join(", ")} (password: DEMO_PASSWORD)`);
  await db.end();
};

main().catch((error) => {
  console.error(`Demo seed failed: ${error.message}`);
  process.exit(1);
});
