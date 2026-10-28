import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { pdfRenderer } from "../helper/pdfRenderer.js";
import { isPrivateAddress, assertPublicUrl, youtubeId } from "../helper/linkIngest.js";
import { safeCell } from "../services/insights.service.js";
import { pool, resetDatabase, createUser, createAssessment, auth, installFakes, enroll, playThrough } from "./helpers.js";

let fakes;
let instructor;
let renderedHtml;
const realRender = pdfRenderer.render;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  queueAdapter.mode = "inline";
  renderedHtml = null;
  pdfRenderer.render = async (html) => {
    renderedHtml = html;
    return Buffer.from("%PDF-fake");
  };
  instructor = await createUser({ role: "instructor", name: "Teacher" });
});

afterAll(async () => {
  pdfRenderer.render = realRender;
  await pool.end();
});

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
const TF = (n, extra = {}) => ({ question_type: "true_false", question_count: n, duration_per_question: 30, positive_marks: 1, negative_marks: 1, ...extra });
const binary = (req) =>
  req.buffer(true).parse((res, done) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => done(null, Buffer.concat(chunks)));
  });

const createDraft = async (fields = {}) => {
  let req = request(app)
    .post("/api/assessments")
    .set("Authorization", auth(instructor))
    .field("title", "Plants")
    .field("prompt", "Photosynthesis")
    .field("question_blocks", JSON.stringify(fields.blocks || [TF(4)]));
  for (const [k, v] of Object.entries(fields.extra || {})) req = req.field(k, v);
  if (fields.file !== false) req = req.attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
  const res = await req;
  return res;
};
const publishedId = async (fields) => {
  const id = (await createDraft(fields)).body.data.id;
  await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en", "ur"] });
  return id;
};
const print = (id, body) => binary(request(app).post(`/api/assessments/${id}/print`).set("Authorization", auth(instructor)).send(body));

describe("printed papers", () => {
  test("same paper: one PDF with the header printed exactly as typed (proper nouns never translated)", async () => {
    const id = await publishedId();
    const res = await print(id, { language: "ur", instituteName: "Govt College Lahore", teacherName: "Mr. Ahmed Khan", subjectName: "Biology" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(renderedHtml).toContain("Govt College Lahore");
    expect(renderedHtml).toContain("Mr. Ahmed Khan");
    expect(renderedHtml).toContain("جوابی کلید");
    expect(renderedHtml).toContain('dir="rtl"');
    expect(fakes.prompts.some((p) => p.purpose === "paper_header_translation")).toBe(false);
    expect((await pool.query("SELECT count(*)::int AS n FROM assessment_attempts")).rows[0].n).toBe(0);
  });

  test("unique per student: different full papers A, B, C with one combined answer key", async () => {
    const id = await publishedId();
    const res = await print(id, { language: "en", mode: "unique", copies: 3 });
    expect(res.status).toBe(200);
    for (const code of ["A", "B", "C"]) expect(renderedHtml).toContain(`Paper ${code}`);
    expect(renderedHtml.match(/Answer key/g)).toHaveLength(1);
    const papers = renderedHtml.split('<section class="paper').slice(1, 4);
    const stems = papers.map((p) => [...p.matchAll(/<bdi>(Synthetic question[^<]*)<\/bdi>/g)].map((m) => m[1]).sort().join("|"));
    expect(new Set(stems).size).toBe(3);
  });

  test("DOCX export", async () => {
    const id = await publishedId();
    const res = await print(id, { language: "ar", format: "docx", instituteName: "مدرسة النور" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/wordprocessingml/);
    expect(res.body.subarray(0, 2).toString()).toBe("PK");
  });

  test("assessments without a pool are limited in the number of unique papers", async () => {
    const legacy = await createAssessment(instructor, undefined, { status: "published" });
    const res = await print(legacy.id, { language: "en", mode: "unique", copies: 10 });
    expect(res.status).toBe(400);
  });
});

describe("negative marking switch and 30-second minimum", () => {
  test("with negative marking off, a wrong answer loses nothing", async () => {
    const id = await publishedId({ blocks: [TF(1)], extra: { negative_marking: "false" } });
    const student = await createUser({ role: "student" });
    await enroll({ id }, student);
    const start = (await request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(student)).send({ language: "en" })).body.data;
    const correct = (await pool.query("SELECT correct_answer FROM generated_questions WHERE id = $1", [start.question.id])).rows[0].correct_answer;
    await request(app).put(`/api/taking/attempts/${start.attemptId}/answers/${start.question.id}`).set("Authorization", auth(student)).send({ answer: !correct });
    const result = (await request(app).post(`/api/taking/assessments/${id}/submit`).set("Authorization", auth(student)).send({ attemptId: start.attemptId })).body.data;
    expect(result.answers[0].negativeMarks).toBe(0);
    expect(result.answers[0].score).toBe(0);
  });

  test("the database refuses question blocks under 30 seconds", async () => {
    const a = await createAssessment(instructor);
    await expect(
      pool.query("INSERT INTO question_blocks (assessment_id, question_type, question_count, duration_per_question) VALUES ($1, 'true_false', 1, 20)", [a.id])
    ).rejects.toThrow(/chk_question_blocks_min_duration/);
  });
});

describe("links and YouTube", () => {
  test("a web page is read with Readability (article, not menus), chunked and labelled", async () => {
    const res = await request(app).post("/api/resources").set("Authorization", auth(instructor)).field("url", "https://example.com/lesson");
    expect(res.status).toBe(201);
    const r = (await pool.query("SELECT content_type, url, extraction_method, content_text, name FROM resources")).rows[0];
    expect(r).toMatchObject({ content_type: "link", url: "https://example.com/lesson", extraction_method: "link", name: "Lesson page" });
    expect(r.content_text).toContain("Plants use sunlight");
    expect(r.content_text).not.toContain("Menu Home About");
    expect((await pool.query("SELECT count(*)::int AS n FROM resource_chunks")).rows[0].n).toBeGreaterThan(0);
  });

  test("a YouTube link is read from its captions", async () => {
    const watch = "https://www.youtube.com/watch?v=abc123XYZ";
    fakes.pages[watch] = {
      body: `<title>Photosynthesis explained - YouTube</title><script>{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=abc123XYZ\\u0026lang=en","languageCode":"en","kind":"standard"}]}</script>`,
    };
    fakes.pages["https://www.youtube.com/api/timedtext?v=abc123XYZ&lang=en"] = {
      contentType: "text/xml",
      body: `<transcript>${Array.from({ length: 30 }, (_, i) => `<text start="${i}">Leaves capture light energy and turn it into sugar step ${i}.</text>`).join("")}</transcript>`,
    };
    const res = await request(app).post("/api/resources").set("Authorization", auth(instructor)).field("url", "https://youtu.be/abc123XYZ");
    expect(res.status).toBe(201);
    const r = (await pool.query("SELECT extraction_method, name, content_text FROM resources")).rows[0];
    expect(r).toMatchObject({ extraction_method: "youtube", name: "Photosynthesis explained" });
    expect(r.content_text).toContain("Leaves capture light energy");
    expect(youtubeId("https://www.youtube.com/shorts/abcdef12")).toBe("abcdef12");
  });

  test("an unreadable link does not block creating the assessment; it is reported", async () => {
    fakes.pages["https://example.com/broken"] = { body: "<html><body></body></html>" };
    const res = await request(app)
      .post("/api/assessments")
      .set("Authorization", auth(instructor))
      .field("title", "Links")
      .field("prompt", "Photosynthesis")
      .field("external_links", JSON.stringify(["https://example.com/broken", "https://example.com/good"]))
      .field("question_blocks", JSON.stringify([TF(2)]));
    expect(res.status).toBe(201);
    expect(res.body.data.skippedLinks.map((s) => s.url)).toEqual(["https://example.com/broken"]);
    const linked = (await pool.query("SELECT r.url FROM assessment_resources ar JOIN resources r ON r.id = ar.resource_id")).rows;
    expect(linked).toEqual([{ url: "https://example.com/good" }]);
  });

  test("private and local addresses are refused (SSRF protection)", async () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    await expect(assertPublicUrl("http://127.0.0.1/admin")).rejects.toMatchObject({ status: 400 });
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toMatchObject({ status: 400 });
    await expect(assertPublicUrl("ftp://example.com/x")).rejects.toMatchObject({ status: 400 });
    await expect(assertPublicUrl("http://example.com:8080/x")).rejects.toMatchObject({ status: 400 });
  });
});

describe("resource library", () => {
  test("the same content uploaded twice is stored once (content hash)", async () => {
    const upload = (name) =>
      request(app).post("/api/resources").set("Authorization", auth(instructor)).attach("files", Buffer.from(LESSON), { filename: name, contentType: "text/plain" });
    await upload("a.txt");
    const second = await upload("b.txt");
    expect(second.status).toBe(201);
    expect((await pool.query("SELECT count(*)::int AS n FROM resources")).rows[0].n).toBe(1);
  });

  test("search, filters and pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/resources")
        .set("Authorization", auth(instructor))
        .attach("files", Buffer.from(`${LESSON} unique topic number ${i} volcano`), { filename: `notes-${i}.txt`, contentType: "text/plain" });
    }
    await request(app).post("/api/resources").set("Authorization", auth(instructor)).field("url", "https://example.com/lesson");
    const search = (q) => request(app).get(`/api/resources/search?${q}`).set("Authorization", auth(instructor));
    const page1 = (await search("page_size=2")).body.data;
    expect(page1).toMatchObject({ total: 6, pages: 3, page: 1 });
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0].content_text).toBeUndefined();
    expect((await search("type=link")).body.data.total).toBe(1);
    expect((await search("search=notes-3")).body.data.items.map((r) => r.name)).toEqual(["notes-3.txt"]);
    expect((await search("search=number%204")).body.data.total).toBe(1);
    const other = await createUser({ role: "instructor" });
    expect((await request(app).get("/api/resources/search").set("Authorization", auth(other))).body.data.total).toBe(0);
  });
});

describe("instructor analytics", () => {
  test("distribution, objective accuracy, hardest objectives, difficulty reached and exports", async () => {
    const id = await publishedId({ blocks: [TF(6)] });
    for (let i = 0; i < 3; i++) {
      const s = await createUser({ role: "student", name: i === 0 ? "=HYPERLINK(evil)" : `Student ${i}` });
      await enroll({ id }, s);
      await playThrough(app, request, id, s);
    }
    const res = await request(app).get(`/api/instructor-analytics/assessment/${id}/insights`).set("Authorization", auth(instructor));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.summary.students).toBe(3);
    expect(d.distribution).toHaveLength(10);
    expect(d.distribution.reduce((s, b) => s + b.count, 0)).toBe(3);
    expect(d.objectives.length).toBeGreaterThan(0);
    expect(d.hardestObjectives.length).toBeGreaterThan(0);
    expect(d.difficultyReached.reduce((s, x) => s + x.final, 0)).toBe(3);

    const csv = await binary(request(app).get(`/api/instructor-analytics/assessment/${id}/export`).set("Authorization", auth(instructor)));
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    const text = csv.body.toString("utf8");
    expect(text).toContain("Student,Email,Language,Score %");
    expect(text).toContain("'=HYPERLINK(evil)");
    const xlsx = await binary(request(app).get(`/api/instructor-analytics/assessment/${id}/export?format=xlsx`).set("Authorization", auth(instructor)));
    expect(xlsx.body.subarray(0, 2).toString()).toBe("PK");

    const other = await createUser({ role: "instructor" });
    expect((await request(app).get(`/api/instructor-analytics/assessment/${id}/insights`).set("Authorization", auth(other))).status).toBe(403);
    expect(safeCell("+cmd")).toBe("'+cmd");
  }, 60000);
});

describe("platform stats", () => {
  test("super admin sees counts and LLM calls, with no cost; others cannot", async () => {
    await pool.query(
      `INSERT INTO llm_usage_log (purpose, provider, model, input_tokens, output_tokens, latency_ms, success)
       VALUES ('question_generation', 'gemini', 'gemini-2.5-flash', 1000000, 100000, 900, TRUE),
              ('study_plan', 'groq', 'mystery-model', 10, 10, 100, FALSE)`
    );
    const superAdmin = await createUser({ role: "super_admin" });
    const res = await request(app).get("/api/admin/stats").set("Authorization", auth(superAdmin));
    expect(res.status).toBe(200);
    const { llm, users } = res.body.data;
    expect(llm.calls).toBe(2);
    expect(llm.failed).toBe(1);
    expect(llm.estimatedCostUsd).toBeUndefined();
    expect(JSON.stringify(res.body.data)).not.toMatch(/cost|price/i);
    expect(llm.inputTokens).toBe(1000010);
    expect(users.instructor).toBe(1);
    expect((await request(app).get("/api/admin/stats").set("Authorization", auth(instructor))).status).toBe(403);
  });
});
