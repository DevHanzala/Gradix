import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { pdfRenderer } from "../helper/pdfRenderer.js";
import { reportHtml } from "../services/learning/report.service.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll } from "./helpers.js";

let fakes;
let instructor;
const realRender = pdfRenderer.render;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  queueAdapter.mode = "inline";
  pdfRenderer.render = async (html) => Buffer.from(`%PDF-fake ${html.length}`);
  instructor = await createUser({ role: "instructor" });
});

afterAll(async () => {
  pdfRenderer.render = realRender;
  await pool.end();
});

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
const TF = { question_type: "true_false", question_count: 6, duration_per_question: 60, positive_marks: 1, negative_marks: 0 };

const published = async () => {
  const res = await request(app)
    .post("/api/assessments")
    .set("Authorization", auth(instructor))
    .field("title", "Plants")
    .field("prompt", "Photosynthesis")
    .field("question_blocks", JSON.stringify([TF]))
    .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
  const id = res.body.data.id;
  await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en", "ur"] });
  return id;
};
const newStudent = async (id) => {
  const s = await createUser({ role: "student" });
  await enroll({ id }, s);
  return s;
};
const correctOf = async (qid) => (await pool.query("SELECT correct_answer FROM generated_questions WHERE id = $1", [qid])).rows[0].correct_answer;

/** Answer questions: decide(i, objectiveId) -> true (correct) / false (wrong). */
const take = async (id, s, decide) => {
  let current = (await request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(s)).send({ language: "en" })).body.data;
  for (let i = 0; i < current.totalQuestions; i++) {
    const row = (await pool.query("SELECT objective_id FROM generated_questions WHERE id = $1", [current.question.id])).rows[0];
    const right = await correctOf(current.question.id);
    await request(app)
      .put(`/api/taking/attempts/${current.attemptId}/answers/${current.question.id}`)
      .set("Authorization", auth(s))
      .send({ answer: decide(i, row.objective_id) ? right : !right });
    const next = (await request(app).post(`/api/taking/attempts/${current.attemptId}/advance`).set("Authorization", auth(s)).send({ fromIndex: i })).body.data;
    if (next.finished) return next.result;
    current = next;
  }
  throw new Error("did not finish");
};
const api = (s) => ({
  results: (id) => request(app).get(`/api/student-analytics/results/${id}`).set("Authorization", auth(s)),
  plan: (id, body = {}) => request(app).post(`/api/student-analytics/results/${id}/study-plan`).set("Authorization", auth(s)).send(body),
  pdf: (id, lang) =>
    request(app)
      .get(`/api/student-analytics/results/${id}/report.pdf${lang ? `?language=${lang}` : ""}`)
      .set("Authorization", auth(s))
      .buffer(true)
      .parse((r, done) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => done(null, Buffer.concat(chunks)));
      }),
  practice: (id, body = {}) => request(app).post(`/api/student-analytics/results/${id}/practice`).set("Authorization", auth(s)).send(body),
  check: (sessionId, index, answer) =>
    request(app).post(`/api/student-analytics/practice/${sessionId}/check`).set("Authorization", auth(s)).send({ index, answer }),
});

describe("results", () => {
  test("not available before submitting (no answers, no objectives leak)", async () => {
    const id = await published();
    const s = await newStudent(id);
    await request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(s)).send({ language: "en" });
    const res = await api(s).results(id);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/correct_answer|objective/i);
  });

  test("scores, accuracy, time, per-objective breakdown, weak areas, path and review with objectives", async () => {
    const id = await published();
    const s = await newStudent(id);
    const objectives = (await pool.query("SELECT id FROM learning_objectives WHERE assessment_id = $1 ORDER BY sort_order", [id])).rows;
    const weakId = objectives[0].id;
    await take(id, s, (i, objectiveId) => objectiveId !== weakId);

    const res = await api(s).results(id);
    expect(res.status).toBe(200);
    const r = res.body.data;
    expect(r.scores.rawPercentage).toBeGreaterThan(0);
    expect(r.scores.rawPercentage).toBeLessThan(100);
    expect(r.accuracy.totalQuestions).toBe(6);
    expect(r.time.totalSeconds).toBeGreaterThanOrEqual(0);
    const weakRow = r.objectives.find((o) => o.objectiveId === weakId);
    expect(weakRow.accuracy).toBe(0);
    expect(r.weakAreas.map((w) => w.objectiveId)).toEqual([weakId]);
    expect(r.difficultyPath).toHaveLength(6);
    expect(r.review).toHaveLength(6);
    expect(r.review.every((q) => q.objective_id && q.correct_answer !== undefined)).toBe(true);
  });

  test("another student's results are not visible", async () => {
    const id = await published();
    const s = await newStudent(id);
    await take(id, s, () => true);
    const other = await newStudent(id);
    expect((await api(other).results(id)).status).toBe(404);
  });
});

describe("study plan", () => {
  test("is generated for the weak objectives, in the requested language, with only real source passages; then cached", async () => {
    const id = await published();
    const s = await newStudent(id);
    await take(id, s, () => false);
    const res = await api(s).plan(id, { language: "ur" });
    expect(res.status).toBe(200);
    const { plan, source, language } = res.body.data;
    expect(language).toBe("ur");
    expect(source).toBe("ai");
    expect(plan.steps.length).toBeGreaterThan(0);
    const allowed = new Set((await pool.query("SELECT id FROM resource_chunks")).rows.map((r) => r.id));
    for (const step of plan.steps) {
      for (const p of step.passages) expect(allowed.has(p.chunkId)).toBe(true);
      expect(step.sourceChunkIds).not.toContain(999999); // hallucinated id dropped
    }
    const prompt = fakes.prompts.find((p) => p.purpose === "study_plan").prompt;
    expect(prompt).toMatch(/entirely in Urdu/);

    const again = await api(s).plan(id, { language: "ur" });
    expect(fakes.prompts.filter((p) => p.purpose === "study_plan")).toHaveLength(1);
    expect(again.body.data.plan).toEqual(plan);
    const stored = (await pool.query("SELECT language, study_plan_source FROM learning_reports")).rows;
    expect(stored).toEqual([{ language: "ur", study_plan_source: "ai" }]);
  });

  test("falls back to a plain plan (never an error) when the model fails", async () => {
    const id = await published();
    const s = await newStudent(id);
    await take(id, s, () => false);
    fakes.ai.study_plan = () => "not json";
    const res = await api(s).plan(id, { language: "ar" });
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe("fallback");
    expect(res.body.data.plan.summary).toMatch(/حصلت/);
  });
});

describe("PDF report", () => {
  test("is rendered in the student's language, stored and reused", async () => {
    const id = await published();
    const s = await newStudent(id);
    await take(id, s, () => false);
    let rendered = null;
    pdfRenderer.render = async (html) => {
      rendered = html;
      return Buffer.from("%PDF-fake");
    };
    await api(s).plan(id, { language: "ur" });
    const res = await api(s).pdf(id, "ur");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.toString()).toBe("%PDF-fake");
    expect(rendered).toContain('lang="ur" dir="rtl"');
    expect(rendered).toContain("Noto Nastaliq Urdu");
    expect(rendered).toContain("آپ کا مطالعہ منصوبہ");
    const stored = (await pool.query("SELECT pdf IS NOT NULL AS has_pdf FROM learning_reports WHERE language = 'ur'")).rows[0];
    expect(stored.has_pdf).toBe(true);

    rendered = null;
    await api(s).pdf(id, "ur");
    expect(rendered).toBeNull(); // cached
  });

  test("the report template escapes user content", () => {
    const html = reportHtml({
      language: "en",
      plan: null,
      results: {
        title: "<script>x</script>",
        completedAt: new Date().toISOString(),
        scores: { rawPercentage: 50, adjustedPercentage: null },
        accuracy: { percentage: 50, correct: 1, totalQuestions: 2 },
        objectives: [],
        weakAreas: [],
        difficultyPath: [],
      },
    });
    expect(html).not.toContain("<script>x");
  });

  test("a real Chromium render produces a PDF with Urdu text", async () => {
    pdfRenderer.render = realRender;
    const id = await published();
    const s = await newStudent(id);
    await take(id, s, () => true);
    const res = await api(s).pdf(id, "ur");
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
  }, 120000);
});

describe("practice quiz", () => {
  test("fresh questions (not from the exam pool), checked by the shared grader, never scored", async () => {
    const id = await published();
    const s = await newStudent(id);
    await take(id, s, () => false);
    const before = (await pool.query("SELECT count(*)::int AS n FROM question_pool")).rows[0].n;
    const scoreBefore = (await pool.query("SELECT score FROM assessment_attempts")).rows[0].score;

    const res = await api(s).practice(id, { count: 3 });
    expect(res.status).toBe(200);
    const { sessionId, questions } = res.body.data;
    expect(questions).toHaveLength(3);
    expect(JSON.stringify(questions)).not.toMatch(/correct/i);
    const poolStems = (await pool.query("SELECT question_text FROM question_pool")).rows.map((r) => r.question_text);
    for (const q of questions) expect(poolStems).not.toContain(q.question_text);
    expect((await pool.query("SELECT count(*)::int AS n FROM question_pool")).rows[0].n).toBe(before);

    const stored = (await pool.query("SELECT questions FROM practice_sessions WHERE id = $1", [sessionId])).rows[0].questions;
    const right = await api(s).check(sessionId, 0, stored[0].correct_answer);
    expect(right.body.data).toMatchObject({ correct: true });
    const wrong = await api(s).check(sessionId, 1, stored[1].question_type === "true_false" ? !stored[1].correct_answer : "zzz");
    expect(wrong.body.data.correct).toBe(false);
    expect(wrong.body.data.correctAnswer).toBeDefined();
    expect((await pool.query("SELECT score FROM assessment_attempts")).rows[0].score).toBe(scoreBefore);
  });

  test("only after submitting, and only the owner can check answers", async () => {
    const id = await published();
    const s = await newStudent(id);
    expect((await api(s).practice(id)).status).toBe(404);
    await take(id, s, () => true);
    const { sessionId } = (await api(s).practice(id, { count: 1 })).body.data;
    const other = await newStudent(id);
    expect((await api(other).check(sessionId, 0, true)).status).toBe(404);
  });
});

describe("dead analytics endpoints are gone", () => {
  test.each(["/overview", "/performance", "/recommendations", "/report"])("%s returns 404", async (path) => {
    const s = await createUser({ role: "student" });
    const res = await request(app).get(`/api/student-analytics${path}`).set("Authorization", auth(s));
    expect(res.status).toBe(404);
  });
});
