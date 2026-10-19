import request from "supertest";
import app from "../app.js";
import { chunkDocument, splitSentences, CHUNK_CONFIG } from "../helper/chunker.js";
import { detectLanguage } from "../helper/language.js";
import { assessTextQuality } from "../helper/textQuality.js";
import { buildBlueprint, apportion, difficultyLevels, spread } from "../services/blueprint.js";
import { validateQuestion, stemHash } from "../services/questions/validation.js";
import { searchAssessmentChunks } from "../services/rag/retrieval.js";
import { rechunkResourceJob } from "../jobs/definitions/resources.js";
import { queueAdapter } from "../jobs/queue.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll, fakeEmbedding, fakeTokenCount, playThrough } from "./helpers.js";

let fakes;
let instructor;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  queueAdapter.mode = "inline";
  instructor = await createUser({ role: "instructor", name: "Teacher" });
});

afterAll(async () => {
  await pool.end();
});

const BLOCKS = [
  { question_type: "multiple_choice", question_count: 4, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 },
  { question_type: "true_false", question_count: 2, duration_per_question: 30, positive_marks: 1, negative_marks: 0 },
];

const paragraph = (topic, n) =>
  Array.from({ length: n }, (_, i) => `The ${topic} fact number ${i} explains how ${topic} works in plants and leaves.`).join(" ");

const LESSON = [paragraph("photosynthesis", 30), paragraph("chlorophyll", 30), paragraph("respiration", 30)].join("\n\n");

const create = (fields = {}, file = LESSON) => {
  let req = request(app)
    .post("/api/assessments")
    .set("Authorization", auth(fields.user || instructor))
    .field("title", fields.title || "Plant biology")
    .field("prompt", fields.prompt ?? "How plants make food")
    .field("question_blocks", JSON.stringify(fields.blocks || BLOCKS));
  if (file) req = req.attach("files", Buffer.from(file), { filename: "lesson.txt", contentType: "text/plain" });
  return req;
};
const getObjectives = (id, user = instructor) =>
  request(app).get(`/api/assessments/${id}/objectives`).set("Authorization", auth(user));
const putObjectives = (id, objectives, user = instructor) =>
  request(app).put(`/api/assessments/${id}/objectives`).set("Authorization", auth(user)).send({ objectives });

// ------------------------------------------------------------------ chunking

describe("chunking", () => {
  test("chunks stay within the token budget and overlap by whole sentences", async () => {
    const chunks = await chunkDocument(LESSON);
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(CHUNK_CONFIG.maxTokens + 2);
    // Most chunks are near the target, not tiny.
    const avg = chunks.reduce((s, c) => s + c.tokenCount, 0) / chunks.length;
    expect(avg).toBeGreaterThan(150);
    // Overlap: the next chunk starts with the last sentence of the previous one.
    const lastSentence = splitSentences(chunks[0].text).at(-1).text;
    expect(chunks[1].text.startsWith(lastSentence)).toBe(true);
  });

  test("Urdu and Arabic text is split at ۔ and ؟ and never mid-sentence", async () => {
    const urdu = Array.from({ length: 80 }, (_, i) => `یہ جملہ نمبر ${i} پودوں کے بارے میں ہے۔`).join(" ");
    const chunks = await chunkDocument(urdu);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.trim().endsWith("۔")).toBe(true);
    expect(splitSentences("ما هذا؟ هذا كتاب.").map((s) => s.text)).toEqual(["ما هذا؟", "هذا كتاب."]);
  });

  test("a very long sentence is split at clause or word boundaries within the budget", async () => {
    const long = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const chunks = await chunkDocument(long);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(CHUNK_CONFIG.maxTokens + 2);
    expect(chunks.map((c) => c.text).join(" ")).toContain("word399");
  });

  test("a short text is one chunk", async () => {
    const chunks = await chunkDocument("قُلْ هُوَ اللَّهُ أَحَدٌ. اللَّهُ الصَّمَدُ.");
    expect(chunks).toHaveLength(1);
  });
});

describe("language and quality", () => {
  test("script-based language detection", () => {
    expect(detectLanguage("Plants make food from sunlight.")).toBe("en");
    expect(detectLanguage("پودے سورج کی روشنی سے اپنی خوراک بناتے ہیں۔")).toBe("ur");
    expect(detectLanguage("النباتات تصنع غذاءها من ضوء الشمس.")).toBe("ar");
    expect(detectLanguage("گیاهان از نور خورشید غذا می‌سازند.")).toBe("fa");
  });

  test("short legitimate texts pass; empty and symbol soup fail", () => {
    expect(assessTextQuality("A short poem about the sea and sky").ok).toBe(true);
    expect(assessTextQuality("   ").reason).toBe("empty");
    expect(assessTextQuality("~~ || ## 12 %% ^^ && ** (( )) !! @@ $$ ++").reason).toBe("garbage");
    expect(assessTextQuality("a b c d e f g h i j k l m n o p").reason).toBe("garbage");
  });
});

// ----------------------------------------------------------------- blueprint

describe("blueprint", () => {
  const objectives = [
    { id: 11, weight: 2 },
    { id: 12, weight: 1 },
    { id: 13, weight: 1 },
  ];

  test("questions per objective follow weights; totals per type match the blocks", () => {
    const bp = buildBlueprint(objectives, BLOCKS);
    expect(bp.total).toBe(6);
    expect(bp.slots).toHaveLength(6);
    expect(bp.objectives.map((o) => o.count)).toEqual([3, 2, 1]);
    expect(bp.slots.filter((s) => s.question_type === "multiple_choice")).toHaveLength(4);
    expect(bp.slots.filter((s) => s.question_type === "true_false")).toHaveLength(2);
    // Every objective is covered.
    for (const o of objectives) expect(bp.slots.some((s) => s.objective_id === o.id)).toBe(true);
    // Durations/marks come from the block of the slot's type.
    expect(bp.slots.find((s) => s.question_type === "true_false").duration_per_question).toBe(30);
  });

  test("every objective gets a question even with a tiny weight", () => {
    const bp = buildBlueprint([{ id: 1, weight: 10 }, { id: 2, weight: 0.5 }], [{ ...BLOCKS[0], question_count: 3 }]);
    expect(bp.objectives.map((o) => o.count)).toEqual([2, 1]);
  });

  test("apportionment, difficulty mix and spreading", () => {
    expect(apportion(10, [2, 1, 1, 1])).toEqual([4, 2, 2, 2]);
    expect(difficultyLevels(10)).toEqual([1, 2, 2, 3, 3, 3, 3, 4, 4, 5]);
    expect(difficultyLevels(1)).toEqual([3]);
    expect(spread([2, 2])).toEqual([0, 1, 0, 1]);
  });

  test("adaptive blueprints leave difficulty to the engine", () => {
    const bp = buildBlueprint(objectives, BLOCKS, { adaptive: true });
    expect(bp.slots.every((s) => s.difficulty === null)).toBe(true);
  });

  test("the blueprint is deterministic, so every student gets the same coverage", () => {
    expect(buildBlueprint(objectives, BLOCKS)).toEqual(buildBlueprint(objectives, BLOCKS));
  });
});

// ------------------------------------------------------- question validation

describe("question validation", () => {
  const mcq = { question_type: "multiple_choice", language: "en", num_options: 4 };
  const good = { question_text: "Which pigment absorbs light?", options: ["Chlorophyll", "Keratin", "Insulin", "Collagen"], correct_answer: "Chlorophyll" };

  test("accepts a well-formed MCQ", () => {
    expect(validateQuestion(good, mcq)).toMatchObject({ ok: true });
  });

  test.each([
    [{ ...good, options: ["A", "A", "B", "C"] }, "duplicate_options"],
    [{ ...good, correct_answer: "Melanin" }, "answer_not_an_option"],
    [{ ...good, options: ["x", "y", "z"] }, "option_count"],
    [{ ...good, correct_answer: ["Chlorophyll", "Keratin"] }, "multiple_correct"],
    [{ ...good, question_text: "کون سا روغن روشنی جذب کرتا ہے؟" }, "wrong_language"],
    [{ ...good, question_text: "Chlorophyll pigment absorbs light: true?", options: ["Chlorophyll pigment", "Keratin", "Insulin", "Collagen"], correct_answer: "Chlorophyll pigment" }, "answer_in_stem"],
  ])("rejects %#", (raw, reason) => {
    expect(validateQuestion(raw, mcq)).toEqual({ ok: false, reason });
  });

  test("stem hash ignores case, punctuation and spacing", () => {
    expect(stemHash("What is  photosynthesis?")).toBe(stemHash("what is photosynthesis"));
  });
});

// ------------------------------------------------------- extraction pipeline

describe("objective extraction", () => {
  test("creating an assessment extracts objectives from retrieved chunks and builds the blueprint", async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("objectives_ready");

    const view = await getObjectives(res.body.data.id);
    expect(view.status).toBe(200);
    const { objectives, blueprint, objectivesState } = view.body.data;
    expect(objectivesState).toBe("ready");
    expect(objectives).toHaveLength(3);
    expect(blueprint.slots).toHaveLength(6);

    // Cited chunks belong to this assessment's material.
    const { rows } = await pool.query("SELECT id FROM resource_chunks");
    const ids = new Set(rows.map((r) => r.id));
    for (const o of objectives) for (const id of o.source_chunk_ids) expect(ids.has(id)).toBe(true);

    // The prompt contained selected passages, not a truncated dump of everything.
    const prompt = fakes.prompts.find((p) => p.purpose === "objective_extraction").prompt;
    const cited = [...prompt.matchAll(/\[chunk (\d+)\]/g)];
    expect(cited.length).toBeGreaterThan(0);
    expect(cited.length).toBeLessThanOrEqual(12);

    const log = await pool.query("SELECT purpose, success FROM llm_usage_log WHERE purpose = 'objective_extraction'");
    expect(log.rows[0]).toEqual({ purpose: "objective_extraction", success: true });
  });

  test("a prompt-only assessment still gets objectives", async () => {
    const res = await create({}, null);
    expect(res.status).toBe(201);
    const view = await getObjectives(res.body.data.id);
    expect(view.body.data.objectives.length).toBeGreaterThanOrEqual(3);
  });

  test("model output with too few objectives marks extraction failed after retries, with a message", async () => {
    fakes.ai.objective_extraction = () => JSON.stringify([{ text: "Only one" }]);
    const res = await create();
    expect(res.status).toBe(201);
    const view = await getObjectives(res.body.data.id);
    expect(view.body.data.objectivesState).toBe("failed");
    expect(view.body.data.objectivesError).toMatch(/manually/);
    expect(view.body.data.status).toBe("draft");
    expect(fakes.prompts.filter((p) => p.purpose === "objective_extraction")).toHaveLength(3);
  });

  test("hallucinated chunk ids are dropped", async () => {
    fakes.aiObjectives = () => [
      { text: "Explain A", source_chunk_ids: [999999], weight: 1 },
      { text: "Explain B", source_chunk_ids: [], weight: 1 },
      { text: "Explain C", weight: 1 },
    ];
    const res = await create();
    const view = await getObjectives(res.body.data.id);
    expect(view.body.data.objectives[0].source_chunk_ids).toEqual([]);
  });

  test("changing only question blocks keeps objectives; changing the prompt re-extracts", async () => {
    const res = await create();
    const id = res.body.data.id;
    const before = (await getObjectives(id)).body.data.objectives;
    await putObjectives(id, [...before.map((o) => ({ id: o.id, text: o.text, weight: o.weight })), { text: "Manual objective" }]);

    const resourceIds = (await pool.query("SELECT resource_id FROM assessment_resources WHERE assessment_id = $1", [id])).rows.map((r) => r.resource_id);
    const blocksOnly = await request(app)
      .put(`/api/assessments/${id}`)
      .set("Authorization", auth(instructor))
      .send({ title: "Plant biology", prompt: "How plants make food", selected_resources: resourceIds, question_blocks: [BLOCKS[0]] });
    expect(blocksOnly.status).toBe(200);
    let view = (await getObjectives(id)).body.data;
    expect(view.objectives).toHaveLength(4);
    expect(view.blueprint.total).toBe(4);

    const newPrompt = await request(app)
      .put(`/api/assessments/${id}`)
      .set("Authorization", auth(instructor))
      .send({ title: "Plant biology", prompt: "Respiration only", selected_resources: resourceIds });
    expect(newPrompt.status).toBe(200);
    view = (await getObjectives(id)).body.data;
    expect(view.objectives).toHaveLength(3);
    expect(view.objectives.every((o) => o.origin === "ai")).toBe(true);
  });
});

// ------------------------------------------------------------ instructor API

describe("objectives API", () => {
  test("edit, add, delete and reorder in one save; blueprint follows the weights", async () => {
    const id = (await create()).body.data.id;
    const [a, b] = (await getObjectives(id)).body.data.objectives;
    const res = await putObjectives(id, [
      { id: b.id, text: "Describe chlorophyll (edited)", weight: 5 },
      { id: a.id, text: a.text, weight: 1 },
      { text: "Compare respiration and photosynthesis", description: "added", weight: 1 },
    ]);
    expect(res.status).toBe(200);
    const { objectives, blueprint, status } = res.body.data;
    expect(status).toBe("objectives_ready");
    expect(objectives.map((o) => o.text)).toEqual(["Describe chlorophyll (edited)", a.text, "Compare respiration and photosynthesis"]);
    expect(objectives[2].origin).toBe("manual");
    const counts = blueprint.objectives.map((o) => o.count);
    expect(counts[0]).toBeGreaterThan(counts[1]);
  });

  test.each([
    [[], /at least one/],
    [[{ text: "ab" }], /3 characters/],
    [[{ text: "Same one" }, { text: "same ONE" }], /duplicates/],
    [[{ text: "Valid text", weight: 50 }], /weight/],
    [Array.from({ length: 16 }, (_, i) => ({ text: `Objective ${i}` })), /At most 15/],
  ])("invalid lists are rejected with a clear 400 (%#)", async (list, message) => {
    const id = (await create()).body.data.id;
    const res = await putObjectives(id, list);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  test("another instructor cannot read or change objectives", async () => {
    const id = (await create()).body.data.id;
    const other = await createUser({ role: "instructor" });
    expect((await getObjectives(id, other)).status).toBe(403);
    expect((await putObjectives(id, [{ text: "Hijack" }], other)).status).toBe(403);
  });

  test("students cannot use the objectives API", async () => {
    const id = (await create()).body.data.id;
    const student = await createUser({ role: "student" });
    expect((await getObjectives(id, student)).status).toBe(403);
  });

  test("objectives are locked once publishing starts", async () => {
    const id = (await create()).body.data.id;
    await pool.query("UPDATE assessments SET status = 'published' WHERE id = $1", [id]);
    expect((await putObjectives(id, [{ text: "Too late" }])).status).toBe(409);
    const regen = await request(app).post(`/api/assessments/${id}/objectives/regenerate`).set("Authorization", auth(instructor));
    expect(regen.status).toBe(409);
  });

  test("regenerate queues a new extraction", async () => {
    const id = (await create()).body.data.id;
    queueAdapter.mode = "record";
    queueAdapter.recorded = [];
    const res = await request(app).post(`/api/assessments/${id}/objectives/regenerate`).set("Authorization", auth(instructor));
    expect(res.status).toBe(202);
    expect(res.body.data.objectivesState).toBe("extracting");
    expect(queueAdapter.recorded).toEqual([{ name: "objectives.extract", data: { assessmentId: id }, singletonKey: `assessment-${id}` }]);
  });
});

// ----------------------------------------------------- retrieval + generation

describe("retrieval and generation", () => {
  test("search only returns chunks of the assessment's own resources, best match first", async () => {
    const mine = (await create()).body.data.id;
    const other = await createUser({ role: "instructor" });
    await create({ user: other, title: "Other" }, paragraph("volcano", 40));

    const hits = await searchAssessmentChunks(mine, "chlorophyll fact explains", 3);
    const allowed = (
      await pool.query(
        "SELECT rc.id FROM resource_chunks rc JOIN assessment_resources ar ON ar.resource_id = rc.resource_id WHERE ar.assessment_id = $1",
        [mine]
      )
    ).rows.map((r) => r.id);
    expect(hits.length).toBe(3);
    for (const h of hits) expect(allowed).toContain(h.id);
    expect(hits[0].chunk_text).toMatch(/chlorophyll/);
  });

  test("questions served to a student carry objective, difficulty, language, sources and stem hash", async () => {
    const id = (await create()).body.data.id;
    const student = await createUser({ role: "student" });
    await enroll({ id }, student);
    const published = await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en", "ur"] });
    expect(published.status).toBe(202);
    const { result } = await playThrough(app, request, id, student, "ur");
    expect(result.answers).toHaveLength(6);

    const { rows } = await pool.query(
      "SELECT objective_id, difficulty, language, source_chunk_ids, stem_hash FROM generated_questions ORDER BY question_order"
    );
    const objectiveIds = (await pool.query("SELECT id FROM learning_objectives WHERE assessment_id = $1", [id])).rows.map((r) => r.id);
    for (const q of rows) {
      expect(objectiveIds).toContain(q.objective_id);
      expect(q.difficulty).toBeGreaterThanOrEqual(1);
      expect(q.difficulty).toBeLessThanOrEqual(5);
      expect(q.language).toBe("ur");
      expect(q.source_chunk_ids.length).toBeGreaterThan(0);
      expect(q.stem_hash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(new Set(rows.map((q) => q.stem_hash)).size).toBe(rows.length);

    // Generation prompts contained only retrieved passages for the objective.
    const genPrompt = fakes.prompts.find((p) => p.purpose === "pool_generation").prompt;
    expect([...genPrompt.matchAll(/\[chunk (\d+)\]/g)].length).toBeLessThanOrEqual(6);
  });

  test("invalid generated questions are dropped and regenerated", async () => {
    const id = (await create()).body.data.id;
    const student = await createUser({ role: "student" });
    await enroll({ id }, student);
    const original = fakes.ai.question_generation;
    let calls = 0;
    fakes.ai.question_generation = (prompt) => {
      calls += 1;
      if (calls === 1) {
        // Duplicate options and an answer that is not an option.
        return JSON.stringify([{ question_type: "multiple_choice", difficulty: 3, question_text: "Bad?", options: ["a", "a", "b", "c"], correct_answer: "z" }]);
      }
      return original(prompt);
    };
    await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en"] });
    const { result } = await playThrough(app, request, id, student);
    expect(result.answers.map((q) => q.questionText)).not.toContain("Bad?");
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM question_pool WHERE question_text = 'Bad?'");
    expect(rows[0].n).toBe(0);
  });
});

// ------------------------------------------------------------------ rechunk

describe("re-chunking existing resources", () => {
  test("a Phase 1 resource is rebuilt from its old chunks with new token counts and model", async () => {
    const { rows } = await pool.query(
      `INSERT INTO resources (name, content_type, visibility, uploaded_by) VALUES ('old', 'file', 'private', $1) RETURNING id`,
      [instructor.id]
    );
    const resourceId = rows[0].id;
    const vector = `[${fakeEmbedding("old").join(",")}]`;
    for (let i = 0; i < 2; i++) {
      await pool.query(`INSERT INTO resource_chunks (resource_id, chunk_text, embedding, chunk_index) VALUES ($1, $2, $3::vector, $4)`, [
        resourceId,
        paragraph(`topic${i}`, 40),
        vector,
        i,
      ]);
    }

    const result = await rechunkResourceJob({ resourceId });
    expect(result.chunks).toBeGreaterThan(2);
    const chunks = await pool.query("SELECT token_count, embedding_model FROM resource_chunks WHERE resource_id = $1", [resourceId]);
    for (const c of chunks.rows) {
      expect(c.token_count).toBeLessThanOrEqual(CHUNK_CONFIG.maxTokens + 2);
      expect(c.embedding_model).toBeTruthy();
    }
    const resource = (await pool.query("SELECT chunking_version, content_text, language FROM resources WHERE id = $1", [resourceId])).rows[0];
    expect(resource).toMatchObject({ chunking_version: 2, language: "en" });
    expect(resource.content_text).toContain("topic1");

    // Idempotent.
    expect(await rechunkResourceJob({ resourceId })).toEqual({ skipped: "current" });
  });

  test("token counting fake roughly matches the real tokenizer ratio", () => {
    expect(fakeTokenCount("one two three four five")).toBe(12);
  });
});
