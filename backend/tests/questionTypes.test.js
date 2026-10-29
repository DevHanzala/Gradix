import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { pdfRenderer } from "../helper/pdfRenderer.js";
import { liveEvents } from "../services/live/liveEvents.js";
import { gradeAnswer, correctAnswerText, canonicalStudentAnswer } from "../utils/grading.js";
import { validateQuestion } from "../services/questions/validation.js";
import { renderPaperDocx } from "../services/paper/paperRender.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll } from "./helpers.js";

let instructor;
let renderedHtml;
const realRender = pdfRenderer.render;
const realEvents = { ...liveEvents };

beforeEach(async () => {
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
  instructor = await createUser({ role: "instructor" });
  renderedHtml = null;
  pdfRenderer.render = async (html) => {
    renderedHtml = html;
    return Buffer.from("%PDF-fake");
  };
  liveEvents.changed = () => {};
  liveEvents.removed = () => {};
});

afterAll(async () => {
  pdfRenderer.render = realRender;
  Object.assign(liveEvents, realEvents);
  await pool.end();
});

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
const BLOCKS = [
  { question_type: "fill_blank", question_count: 2, duration_per_question: 60, positive_marks: 2, negative_marks: 0.5 },
  { question_type: "matching", question_count: 2, duration_per_question: 90, num_options: 4, positive_marks: 2, negative_marks: 0.5 },
];
const publishedId = async (blocks = BLOCKS, languages = ["en"]) => {
  const res = await request(app)
    .post("/api/assessments")
    .set("Authorization", auth(instructor))
    .field("title", "Plants")
    .field("prompt", "Photosynthesis")
    .field("question_blocks", JSON.stringify(blocks))
    .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
  expect(res.status).toBe(201);
  const id = res.body.data.id;
  await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages });
  return id;
};

/** A real PNG made with the same canvas library the app uses. */
const pngImage = async (width = 1600, height = 900) => {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2e7d32";
  ctx.fillRect(0, 0, width, height);
  return canvas.encode("png");
};

describe("grading the new types", () => {
  test("fill in the blank: several accepted answers per blank, compared Unicode-safely, all blanks needed", () => {
    const q = {
      question_type: "fill_blank",
      question_text: "پودے [[1]] سے خوراک بناتے ہیں اور [[2]] خارج کرتے ہیں۔",
      correct_answer: { blanks: [["سورج کی روشنی", "دھوپ"], ["آکسیجن"]] },
      positive_marks: 2,
      negative_marks: 0.5,
    };
    // Extra spaces, punctuation and the Arabic tatweel are ignored.
    expect(gradeAnswer(q, ["  دھوپ۔ ", "آکسیـجن"])).toMatchObject({ correct: true, score: 2 });
    expect(gradeAnswer(q, ["سورج کی روشنی", "پانی"])).toMatchObject({ correct: false, score: -0.5 });
    expect(gradeAnswer(q, ["", ""])).toMatchObject({ answered: false, score: 0 });
    expect(correctAnswerText(q)).toBe("(1) سورج کی روشنی / دھوپ  (2) آکسیجن");
  });

  test("matching: partial credit when enabled, all-or-nothing otherwise; negative marks only for nothing right", () => {
    const q = {
      question_type: "matching",
      options: { left: ["Sun", "Moon", "Earth", "Mars"], right: ["Planet", "Star", "Red planet", "Satellite"] },
      correct_answer: { pairs: { 0: "Star", 1: "Satellite", 2: "Planet", 3: "Red planet" }, partial_credit: true },
      positive_marks: 4,
      negative_marks: 1,
    };
    expect(gradeAnswer(q, { 0: "Star", 1: "Satellite", 2: "Planet", 3: "Red planet" })).toMatchObject({ correct: true, score: 4, fraction: 1 });
    expect(gradeAnswer(q, { 0: "Star", 1: "Satellite", 2: "Red planet", 3: "Planet" })).toMatchObject({ correct: false, score: 2, fraction: 0.5 });
    expect(gradeAnswer(q, { 0: "Planet", 1: "Star", 2: "Satellite", 3: "Satellite" })).toMatchObject({ score: -1 });
    const strict = { ...q, correct_answer: { ...q.correct_answer, partial_credit: false } };
    expect(gradeAnswer(strict, { 0: "Star", 1: "Satellite", 2: "Red planet", 3: "Planet" })).toMatchObject({ score: -1 });
    expect(JSON.parse(canonicalStudentAnswer(q, { 0: "Star", 9: "x" }))).toEqual({ 0: "Star" });
  });

  test("AI output is validated: blank numbering, answers per blank, no leaks; matching pairs distinct and in language", () => {
    const spec = { question_type: "fill_blank", language: "en" };
    expect(validateQuestion({ question_text: "Plants make [[1]] using [[2]].", correct_answer: { blanks: [["sugar"], ["light", "sunlight"]] } }, spec).ok).toBe(true);
    expect(validateQuestion({ question_text: "Plants make [[2]].", correct_answer: { blanks: [["sugar"]] } }, spec).reason).toBe("blank_numbering");
    expect(validateQuestion({ question_text: "Plants make [[1]] and [[2]].", correct_answer: { blanks: [["sugar"]] } }, spec).reason).toBe("blank_answers");
    expect(validateQuestion({ question_text: "Sugar: plants make [[1]].", correct_answer: { blanks: [["sugar"]] } }, spec).reason).toBe("answer_in_stem");
    expect(validateQuestion({ question_text: "No blanks here.", correct_answer: { blanks: [] } }, spec).reason).toBe("blank_count");

    const m = { question_type: "matching", language: "en", num_options: 3 };
    const good = validateQuestion({ question_text: "Match", pairs: [["Sun", "Star"], ["Moon", "Satellite"], ["Earth", "Planet"]] }, m);
    expect(good.ok).toBe(true);
    expect(good.question.options.left).toEqual(["Sun", "Moon", "Earth"]);
    expect(good.question.options.right.sort()).toEqual(["Planet", "Satellite", "Star"]);
    expect(good.question.correct_answer.pairs).toEqual({ 0: "Star", 1: "Satellite", 2: "Planet" });
    expect(validateQuestion({ question_text: "Match", pairs: [["Sun", "Star"], ["Moon", "Star"], ["Earth", "Planet"]] }, m).reason).toBe("duplicate_options");
    expect(validateQuestion({ question_text: "Match", pairs: [["Sun", "Star"]] }, m).reason).toBe("pair_count");
    expect(validateQuestion({ question_text: "جوڑیں", pairs: [["سورج", "Star"], ["چاند", "سیارچہ"], ["زمین", "سیارہ"]] }, { ...m, language: "ur" }).reason).toBe("wrong_language");
  });
});

describe("graded exam with fill-in-the-blank and matching", () => {
  test("generated, served without answers, graded with partial credit and negative marking, reviewed", async () => {
    const id = await publishedId();
    const types = (await pool.query("SELECT DISTINCT question_type FROM question_pool WHERE assessment_id = $1", [id])).rows.map((r) => r.question_type).sort();
    expect(types).toEqual(["fill_blank", "matching"]);

    const student = await createUser({ role: "student" });
    await enroll({ id }, student);
    const S = { Authorization: auth(student) };
    const startRes = await request(app).post(`/api/taking/assessments/${id}/start`).set(S).send({ language: "en" });
    expect(startRes.body).toMatchObject({ success: true });
    let current = startRes.body.data;
    let expected = 0;
    let firstMatching = true;
    for (let i = 0; i < current.totalQuestions; i++) {
      const q = current.question;
      const row = (await pool.query("SELECT question_type, options, correct_answer FROM generated_questions WHERE id = $1", [q.id])).rows[0];
      // The student never receives the answer, only what they need to answer.
      expect(JSON.stringify(q)).not.toMatch(/correct_answer|pairs|blanks/);
      let answer;
      if (q.question_type === "fill_blank") {
        expect(q.options).toBeNull();
        answer = row.correct_answer.blanks.map((accepted) => accepted[0]);
        expected += 2;
      } else {
        expect(q.options.left).toHaveLength(4);
        expect(q.options.right).toHaveLength(4);
        answer = { ...row.correct_answer.pairs };
        if (firstMatching) {
          // Swap two pairs: 2 of 4 right -> half marks.
          [answer[0], answer[1]] = [answer[1], answer[0]];
          firstMatching = false;
          expected += 1;
        } else {
          expected += 2;
        }
      }
      const saved = await request(app).put(`/api/taking/attempts/${current.attemptId}/answers/${q.id}`).set(S).send({ answer });
      expect(saved.status).toBe(200);
      const next = (await request(app).post(`/api/taking/attempts/${current.attemptId}/advance`).set(S).send({ fromIndex: i })).body.data;
      if (next.finished) break;
      current = next;
    }
    const attempt = (await pool.query("SELECT id, score FROM assessment_attempts WHERE student_id = $1", [student.id])).rows[0];
    expect(Number(attempt.score)).toBeCloseTo(expected, 5);

    const results = (await request(app).get(`/api/student-analytics/results/${id}`).set(S)).body.data;
    const review = results.review || results.questions || [];
    const matching = review.find((r) => r.question_type === "matching" && !r.is_correct);
    expect(matching).toMatchObject({ fraction: 0.5, score: 1 });
    expect(matching.correct_answer_text).toMatch(/→/);
    expect(review.find((r) => r.question_type === "fill_blank").correct_answer_text).toMatch(/^\(1\) /);
  });

  test("print papers: blanks as lines, matching as two columns, answer key; DOCX too", async () => {
    const id = await publishedId(BLOCKS, ["en", "ur"]);
    const res = await request(app).post(`/api/assessments/${id}/print`).set("Authorization", auth(instructor)).send({ language: "ur", instituteName: "School" });
    expect(res.status).toBe(200);
    expect(renderedHtml).toContain("__________");
    expect(renderedHtml).toContain('<table class="matching">');
    expect(renderedHtml).toContain("ہر نمبر کے آگے متعلقہ حرف لکھیں");
    expect(renderedHtml).not.toContain("[[1]]");
    expect(renderedHtml).toMatch(/<li><bdi>1–[A-D], 2–[A-D]/);
    const docx = await request(app).post(`/api/assessments/${id}/print`).set("Authorization", auth(instructor)).send({ language: "ur", format: "docx", instituteName: "School" });
    expect(docx.status).toBe(200);
  });
});

describe("images", () => {
  test("upload compresses to WebP; questions need alt text; images reach students as signed URLs and print in PDF and DOCX", async () => {
    const id = await publishedId([{ question_type: "multiple_choice", question_count: 3, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 }]);
    const upload = await request(app)
      .post(`/api/assessments/${id}/question-images`)
      .set("Authorization", auth(instructor))
      .attach("image", await pngImage(), { filename: "leaf.png", contentType: "image/png" });
    expect(upload.status).toBe(201);
    expect(upload.body.data).toMatchObject({ width: 1280, height: 720 });
    expect(upload.body.data.key).toMatch(new RegExp(`^question-images/${id}/[\\w-]+\\.webp$`));
    const key = upload.body.data.key;

    const bad = await request(app)
      .post(`/api/assessments/${id}/question-images`)
      .set("Authorization", auth(instructor))
      .attach("image", Buffer.from("not an image"), { filename: "x.png", contentType: "image/png" });
    expect(bad.status).toBe(400);
    const other = await createUser({ role: "instructor" });
    expect(
      (await request(app).post(`/api/assessments/${id}/question-images`).set("Authorization", auth(other)).attach("image", await pngImage(10, 10), { filename: "a.png", contentType: "image/png" })).status
    ).toBe(403);

    const objective = (await pool.query("SELECT id FROM learning_objectives WHERE assessment_id = $1 LIMIT 1", [id])).rows[0].id;
    const base = {
      objective_id: objective,
      question_type: "multiple_choice",
      difficulty: 3,
      language: "en",
      question_text: "Which part of the plant is shown?",
      options: ["Leaf", "Root", "Stem", "Flower"],
      correct_answer: "Leaf",
    };
    const add = (body) => request(app).post(`/api/assessments/${id}/questions`).set("Authorization", auth(instructor)).send(body);
    expect((await add({ ...base, image: { key, alt: "" } })).status).toBe(400); // alt text is required
    expect((await add({ ...base, image: { key: "question-images/999/x.webp", alt: "Leaf" } })).status).toBe(400); // another assessment's file
    const created = await add({ ...base, image: { key, alt: "A green leaf" }, option_images: [{ key, alt: "Leaf photo" }, null, null, null] });
    expect(created.status).toBe(201);
    expect(created.body.data.image).toMatchObject({ alt: "A green leaf" });
    expect(created.body.data.image.url).toMatch(/\/api\/files\/question-images\//);
    expect(created.body.data.optionImages[0].alt).toBe("Leaf photo");

    // The signed URL serves the WebP file.
    const url = new URL(created.body.data.image.url);
    const file = await request(app).get(url.pathname + url.search);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("image/webp");

    // In an exam the image arrives as a signed URL with its alt text.
    const student = await createUser({ role: "student" });
    await enroll({ id }, student);
    const started = (await request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(student)).send({ language: "en" })).body.data;
    await pool.query("UPDATE generated_questions SET image = $2 WHERE id = $1", [started.question.id, JSON.stringify({ key, alt: "A green leaf" })]);
    const state = (await request(app).get(`/api/taking/assessments/${id}/attempt`).set("Authorization", auth(student))).body.data;
    expect(state.question.image).toMatchObject({ alt: "A green leaf" });
    expect(state.question.image.url).toContain("/api/files/");

    // Printing embeds the image (data URI in the PDF; PNG inside the DOCX).
    const { buildPaperSets } = await import("../services/paper/paperSets.js");
    void buildPaperSets;
    const sets = [{ code: "A", questions: [{ ...base, image: { key, alt: "A green leaf" }, option_images: [{ key, alt: "Leaf photo" }, null, null, null] }] }];
    const { renderPaperPdf } = await import("../services/paper/paperRender.js");
    await renderPaperPdf({ sets: structuredClone(sets), headers: { instituteName: "School" }, language: "en" });
    expect(renderedHtml).toContain('src="data:image/webp;base64,');
    expect(renderedHtml).toContain('alt="A green leaf"');
    const docx = await renderPaperDocx({ sets: structuredClone(sets), headers: { instituteName: "School" }, language: "en" });
    expect(docx.includes(Buffer.from("word/media/"))).toBe(true);
  });
});

describe("live sessions with the new types", () => {
  test("a matching question in a live session: answer shapes, scoring and reveal text", async () => {
    const id = await publishedId([{ question_type: "matching", question_count: 3, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 }]);
    const T = { Authorization: auth(instructor) };
    const { session } = (await request(app).post("/api/live/sessions").set(T).send({ source: "bank", assessmentId: id, count: 2 })).body.data;
    const { token } = (await request(app).post("/api/live/join").send({ code: session.code, nickname: "Ali" })).body.data;
    await request(app).post(`/api/live/sessions/${session.id}/control`).set(T).send({ action: "start" });
    const me = (await request(app).get("/api/live/me").set("X-Live-Token", token)).body.data;
    expect(me.question.type).toBe("matching");
    expect(me.question.options.left).toHaveLength(4);
    const row = (await pool.query("SELECT correct_answer FROM live_questions WHERE session_id = $1 AND idx = 0", [session.id])).rows[0];
    const answered = await request(app).post("/api/live/me/answer").set("X-Live-Token", token).send({ index: 0, answer: row.correct_answer.pairs });
    expect(answered.status).toBe(200);
    await request(app).post(`/api/live/sessions/${session.id}/control`).set(T).send({ action: "reveal" });
    const revealed = (await request(app).get("/api/live/me").set("X-Live-Token", token)).body.data;
    expect(revealed.myAnswer.correct).toBe(true);
    expect(revealed.reveal.correctAnswer).toMatch(/→/);
  });
});
