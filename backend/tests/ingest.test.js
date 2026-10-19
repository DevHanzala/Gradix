import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import request from "supertest";
import app from "../app.js";
import { extractTextFromFile } from "../helper/textProcessor.js";
import { embeddingAdapter } from "../helper/embeddingGenerator.js";
import { pool, resetDatabase, createUser, createAssessment, auth, installFakes, flushEmails } from "./helpers.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const words = (n) => Buffer.from(Array.from({ length: n }, (_, i) => `word${i}`).join(" "));
const BLOCKS = JSON.stringify([
  { question_type: "multiple_choice", question_count: 2, duration_per_question: 30, num_options: 4, positive_marks: 1, negative_marks: 0 },
]);

let fakes;
let instructor;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  instructor = await createUser({ role: "instructor", name: "Teacher Ali" });
});

afterAll(async () => {
  await pool.end();
});

const createWithFile = (buffer, filename = "notes.txt", extra = {}) => {
  let req = request(app).post("/api/assessments").set("Authorization", auth(instructor)).field("title", extra.title || "Biology");
  if (extra.prompt !== undefined) req = req.field("prompt", extra.prompt);
  return req.field("question_blocks", BLOCKS).attach("files", buffer, { filename, contentType: "text/plain" });
};
const counts = async () =>
  (await pool.query("SELECT (SELECT count(*) FROM assessments)::int AS a, (SELECT count(*) FROM resources)::int AS r, (SELECT count(*) FROM resource_chunks)::int AS c")).rows[0];

describe("text extraction and chunking", () => {
  test("OCR reads text from an image", async () => {
    const text = await extractTextFromFile(readFileSync(path.join(fixtures, "ocr-sample.png")), "image/png");
    expect(text).toMatch(/Photosynthesis/i);
    expect(text).toMatch(/chlorophyll/i);
  }, 60000);

  test("a scanned PDF (no text layer) falls back to OCR", async () => {
    const text = await extractTextFromFile(readFileSync(path.join(fixtures, "scanned-sample.pdf")), "application/pdf");
    expect(text).toMatch(/Photosynthesis/i);
  }, 60000);

  test("a tiny document fails with a clear 422, never a 500", async () => {
    await expect(extractTextFromFile(Buffer.from("too short"), "text/plain")).rejects.toMatchObject({ status: 422 });
  });

  test("a short legitimate text (a short surah) is accepted", async () => {
    const surah = "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ";
    await expect(extractTextFromFile(Buffer.from(surah), "text/plain")).resolves.toContain("الصَّمَدُ");
  });

  test("OCR garbage is rejected with an explanation", async () => {
    const garbage = "|| ~~ %% 1 2 3 ;; ## @@ !! ^^ && ** (( )) == ++ -- __ ,, .. ?? // \\ || ~~ %%";
    await expect(extractTextFromFile(Buffer.from(garbage), "text/plain")).rejects.toMatchObject({
      status: 422,
      message: expect.stringMatching(/could not be read reliably/),
    });
  });
});

describe("assessment creation", () => {
  test("title + prompt is enough", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .set("Authorization", auth(instructor))
      .field("title", "Prompt only")
      .field("prompt", "Photosynthesis basics")
      .field("question_blocks", BLOCKS);
    expect(res.status).toBe(201);
  });

  test("a title without any source is rejected", async () => {
    const res = await request(app).post("/api/assessments").set("Authorization", auth(instructor)).field("title", "Empty").field("question_blocks", BLOCKS);
    expect(res.status).toBe(400);
  });

  test("time per question below 30 seconds is rejected by the server", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .set("Authorization", auth(instructor))
      .field("title", "Fast")
      .field("prompt", "x")
      .field("question_blocks", JSON.stringify([{ question_type: "true_false", question_count: 1, duration_per_question: 10 }]));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/30/);
  });

  test("an uploaded file is chunked, embedded and linked; url and file_type are stored", async () => {
    const res = await createWithFile(words(620), "notes.txt", { prompt: "" });
    expect(res.status).toBe(201);
    const { rows } = await pool.query(
      `SELECT r.file_type, r.name, (SELECT count(*)::int FROM resource_chunks rc WHERE rc.resource_id = r.id) AS chunks
       FROM assessment_resources ar JOIN resources r ON r.id = ar.resource_id WHERE ar.assessment_id = $1`,
      [res.body.data.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ file_type: "text/plain", name: "notes.txt" });
    expect(rows[0].chunks).toBeGreaterThan(1);
    const meta = await pool.query("SELECT content_hash, language, chunking_version, embedding_model FROM resources");
    expect(meta.rows[0]).toMatchObject({ language: "en", chunking_version: 2 });
    expect(meta.rows[0].content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("if embedding fails nothing is written (atomic)", async () => {
    const before = await counts();
    embeddingAdapter.embed = async () => {
      throw new Error("model unavailable");
    };
    const res = await createWithFile(words(620), "notes.txt", { prompt: "x" });
    expect(res.status).toBe(500);
    expect(await counts()).toEqual(before);
  });

  test("an unreadable file returns 422 naming the file, and nothing is written", async () => {
    const res = await createWithFile(Buffer.from("tiny"), "tiny.txt");
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/tiny\.txt/);
    expect(await counts()).toEqual({ a: 0, r: 0, c: 0 });
  });
});

describe("editing", () => {
  test("new files sent as 'files' are added before execution", async () => {
    const assessment = await createAssessment(instructor);
    const res = await request(app)
      .put(`/api/assessments/${assessment.id}`)
      .set("Authorization", auth(instructor))
      .field("title", "Edited")
      .field("prompt", "Edited prompt")
      .attach("files", words(300), { filename: "extra.txt", contentType: "text/plain" });
    expect(res.status).toBe(200);
    const { rows } = await pool.query("SELECT count(*)::int AS c FROM assessment_resources WHERE assessment_id = $1", [assessment.id]);
    expect(rows[0].c).toBe(1);
  });

  test("an unexpected upload field is a 400, not a 500", async () => {
    const assessment = await createAssessment(instructor);
    const res = await request(app)
      .put(`/api/assessments/${assessment.id}`)
      .set("Authorization", auth(instructor))
      .field("title", "Edited")
      .field("prompt", "p")
      .attach("new_files", words(300), { filename: "extra.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });
});

describe("resources", () => {
  test("link resources keep their URL", async () => {
    const res = await request(app)
      .post("/api/resources")
      .set("Authorization", auth(instructor))
      .field("url", "https://example.com/lesson")
      .field("name", "Lesson");
    expect(res.status).toBe(201);
    const { rows } = await pool.query("SELECT url, content_type FROM resources WHERE name = 'Lesson'");
    expect(rows[0]).toEqual({ url: "https://example.com/lesson", content_type: "link" });
  });

  test("bulk upload keeps good files and reports unreadable ones", async () => {
    const res = await request(app)
      .post("/api/resources")
      .set("Authorization", auth(instructor))
      .attach("files", words(100), { filename: "good.txt", contentType: "text/plain" })
      .attach("files", Buffer.from("bad"), { filename: "bad.txt", contentType: "text/plain" });
    expect(res.status).toBe(201);
    expect(res.body.resources).toHaveLength(1);
    expect(res.body.skipped[0].file).toBe("bad.txt");
  });
});

describe("enrollment email", () => {
  test("contains the student name, assessment title and instructor; never 'Invalid Date'", async () => {
    const student = await createUser({ role: "student", name: "Sara" });
    const assessment = await createAssessment(instructor);
    const res = await request(app)
      .post(`/api/assessments/${assessment.id}/enroll`)
      .set("Authorization", auth(instructor))
      .send({ email: student.email.toUpperCase() });
    expect(res.status).toBe(200);
    await flushEmails();
    const mail = fakes.sentEmails.find((m) => m.to === student.email);
    expect(mail.subject).toContain("Sample");
    expect(mail.html).toContain("Hi Sara");
    expect(mail.html).toContain("Teacher Ali");
    expect(mail.html).not.toContain("Invalid Date");
  });

  test("an email failure does not fail the request", async () => {
    const { mailer } = await import("../helper/emailService.js");
    mailer.send = async () => {
      throw new Error("SMTP down");
    };
    const student = await createUser({ role: "student" });
    const assessment = await createAssessment(instructor);
    const res = await request(app)
      .post(`/api/assessments/${assessment.id}/enroll`)
      .set("Authorization", auth(instructor))
      .send({ email: student.email });
    expect(res.status).toBe(200);
  });
});

describe("printed paper", () => {
  test("an Urdu paper is a PDF and creates no attempts", async () => {
    const assessment = await createAssessment(instructor);
    fakes.aiQuestions = [
      { question_type: "multiple_choice", question_text: "پاکستان کا دارالحکومت؟", options: ["لاہور", "اسلام آباد", "کراچی", "پشاور"], correct_answer: "B" },
      { question_type: "multiple_choice", question_text: "سورج کہاں سے نکلتا ہے؟", options: ["مشرق", "مغرب", "شمال", "جنوب"], correct_answer: "مشرق" },
    ];
    const res = await request(app)
      .post(`/api/assessments/${assessment.id}/print`)
      .set("Authorization", auth(instructor))
      .send({ language: "ur", instituteName: "Govt College" })
      .buffer(true)
      .parse((response, done) => {
        const chunks = [];
        response.on("data", (c) => chunks.push(c));
        response.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.body.subarray(0, 4).toString()).toBe("%PDF");
    const { rows } = await pool.query("SELECT count(*)::int AS c FROM assessment_attempts");
    expect(rows[0].c).toBe(0);
  }, 90000);
});
