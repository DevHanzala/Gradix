import request from "supertest";
import app from "../app.js";
import { computeTargets, distinctSets, MIN_DISTINCT_SETS } from "../services/pool/targets.js";
import { buildBlueprint } from "../services/blueprint.js";
import { matchesLanguage } from "../services/questions/validation.js";
import { queueAdapter } from "../jobs/queue.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll, playThrough } from "./helpers.js";

let fakes;
let instructor;

beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  queueAdapter.mode = "inline";
  queueAdapter.recorded = [];
  instructor = await createUser({ role: "instructor", name: "Teacher" });
});

afterAll(async () => {
  await pool.end();
});

const MCQ = { question_type: "multiple_choice", question_count: 3, duration_per_question: 60, num_options: 4, positive_marks: 1, negative_marks: 0 };
const TF = { question_type: "true_false", question_count: 2, duration_per_question: 30, positive_marks: 1, negative_marks: 0 };
const SA = { question_type: "short_answer", question_count: 1, duration_per_question: 90, positive_marks: 2, negative_marks: 0 };
const LESSON = Array.from({ length: 60 }, (_, i) => `Photosynthesis fact ${i}: plants turn light, water and carbon dioxide into sugar.`).join(" ");

const createDraft = async (blocks = [MCQ, TF, SA]) => {
  const res = await request(app)
    .post("/api/assessments")
    .set("Authorization", auth(instructor))
    .field("title", "Plants")
    .field("prompt", "Photosynthesis")
    .field("question_blocks", JSON.stringify(blocks))
    .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
  expect(res.status).toBe(201);
  return res.body.data.id;
};
const publish = (id, languages = ["en", "ur"], user = instructor) =>
  request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(user)).send({ languages });
const makePublished = async (blocks, languages) => {
  const id = await createDraft(blocks);
  expect((await publish(id, languages)).status).toBe(202);
  return id;
};
const start = (id, student, language = "en") =>
  request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(student)).send({ language });
const newStudent = async (id) => {
  const s = await createUser({ role: "student" });
  await enroll({ id }, s);
  return s;
};
const attemptPoolIds = async (attemptId) =>
  (await pool.query("SELECT pool_question_id FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order", [attemptId])).rows.map(
    (r) => r.pool_question_id
  );

// ------------------------------------------------------------------ targets

describe("pool sizing", () => {
  const objectives = [{ id: 1, weight: 1 }, { id: 2, weight: 1 }];

  test("a fixed-difficulty pool allows at least 30 different full sets", () => {
    for (const blocks of [[MCQ, TF, SA], [{ ...MCQ, question_count: 1 }], [{ ...TF, question_count: 2 }]]) {
      const buckets = computeTargets(buildBlueprint(objectives, blocks));
      expect(distinctSets(buckets)).toBeGreaterThanOrEqual(MIN_DISTINCT_SETS);
      for (const b of buckets) expect(b.target).toBeGreaterThan(b.minimum);
    }
  });

  test("an adaptive pool has every difficulty for every objective and type", () => {
    const buckets = computeTargets(buildBlueprint(objectives, [MCQ], { adaptive: true }));
    for (const id of [1, 2]) {
      expect(buckets.filter((b) => b.objective_id === id).map((b) => b.difficulty).sort()).toEqual([1, 2, 3, 4, 5]);
    }
  });
});

// --------------------------------------------------------------- publishing

describe("publishing", () => {
  test("publishing pre-generates a validated pool per language and then marks the assessment published", async () => {
    const id = await makePublished([MCQ, TF, SA], ["en", "ur", "ar"]);
    const status = await request(app).get(`/api/assessments/${id}/pool/status`).set("Authorization", auth(instructor));
    expect(status.status).toBe(200);
    expect(status.body.data.status).toBe("published");
    expect(status.body.data.languages.map((l) => [l.language, l.state, l.ready])).toEqual([
      ["en", "ready", true],
      ["ur", "ready", true],
      ["ar", "ready", true],
    ]);
    for (const l of status.body.data.languages) expect(l.percent).toBe(100);

    const { rows } = await pool.query("SELECT language, question_type, question_text, options, correct_answer, stem_hash, objective_id, difficulty FROM question_pool");
    expect(rows.length).toBeGreaterThan(0);
    for (const q of rows) {
      expect(matchesLanguage(q.question_text, q.language)).toBe(true);
      expect(q.objective_id).toBeTruthy();
      if (q.question_type === "multiple_choice") {
        expect(q.options).toHaveLength(4);
        expect(q.options).toContain(q.correct_answer);
        expect(new Set(q.options).size).toBe(4);
      }
      if (q.question_type === "short_answer") expect(q.correct_answer.rubric.length).toBeGreaterThan(0);
    }
    const perLanguage = (lang) => rows.filter((r) => r.language === lang).map((r) => r.stem_hash);
    for (const lang of ["en", "ur", "ar"]) expect(new Set(perLanguage(lang)).size).toBe(perLanguage(lang).length);
  });

  test("Persian is optional and only generated when chosen", async () => {
    await makePublished([TF], ["en"]);
    const { rows } = await pool.query("SELECT DISTINCT language FROM question_pool");
    expect(rows.map((r) => r.language)).toEqual(["en"]);
  });

  test("publishing requires reviewed objectives, a valid language and ownership", async () => {
    const id = await createDraft();
    await pool.query("UPDATE assessments SET status = 'draft' WHERE id = $1", [id]);
    expect((await publish(id)).status).toBe(409);
    await pool.query("UPDATE assessments SET status = 'objectives_ready' WHERE id = $1", [id]);
    expect((await publish(id, ["xx"])).status).toBe(400);
    const other = await createUser({ role: "instructor" });
    expect((await publish(id, ["en"], other)).status).toBe(403);
    expect((await publish(id, ["en"])).status).toBe(202);
    expect((await publish(id, ["en"])).status).toBe(409); // already publishing/published
  });

  test("objectives and assessment settings are locked after publishing", async () => {
    const id = await makePublished([TF], ["en"]);
    const put = await request(app).put(`/api/assessments/${id}/objectives`).set("Authorization", auth(instructor)).send({ objectives: [{ text: "Late change" }] });
    expect(put.status).toBe(409);
    const edit = await request(app).put(`/api/assessments/${id}`).set("Authorization", auth(instructor)).send({ title: "x", prompt: "y" });
    expect(edit.status).toBe(409);
  });

  test("near-duplicate questions (same words, different order) are stored once", async () => {
    const id = await createDraft([{ ...TF, question_count: 1 }]);
    fakes.ai.question_generation = () =>
      JSON.stringify([
        { question_type: "true_false", difficulty: 3, question_text: "Plants make sugar from light", correct_answer: true },
        { question_type: "true_false", difficulty: 3, question_text: "From light plants make sugar", correct_answer: true },
      ]);
    await publish(id, ["en"]);
    const { rows } = await pool.query("SELECT question_text FROM question_pool");
    expect(rows).toHaveLength(1);
  });

  test("when generation keeps failing the language is marked failed (not stuck), and retry re-queues it", async () => {
    const id = await createDraft([TF]);
    fakes.ai.question_generation = () => "not json";
    await publish(id, ["en"]);
    let status = (await request(app).get(`/api/assessments/${id}/pool/status`).set("Authorization", auth(instructor))).body.data;
    expect(status.status).toBe("publishing");
    expect(status.languages[0]).toMatchObject({ state: "failed", ready: false });
    expect(status.languages[0].error).toMatch(/manually/);

    fakes.ai.question_generation = undefined; // back to the default synthetic generator
    installFakes();
    const retry = await request(app).post(`/api/assessments/${id}/publish/retry`).set("Authorization", auth(instructor));
    expect(retry.status).toBe(202);
    status = (await request(app).get(`/api/assessments/${id}/pool/status`).set("Authorization", auth(instructor))).body.data;
    expect(status.status).toBe("published");
  });
});

// ------------------------------------------------------------------ serving

describe("serving from the pool", () => {
  test("students cannot start before publishing, or in a language that is not offered", async () => {
    const id = await createDraft([TF]);
    const student = await newStudent(id);
    const early = await start(id, student);
    expect(early.status).toBe(409);
    expect(early.body.code).toBe("NOT_PUBLISHED");

    await publish(id, ["en"]);
    expect((await start(id, student, "ar")).status).toBe(400);
  });

  test("students wait while their language's pool is still being prepared", async () => {
    const id = await createDraft([TF]);
    const student = await newStudent(id);
    queueAdapter.mode = "record"; // the fill job has not run yet
    await publish(id, ["en", "ur"]);
    const res = await start(id, student, "ur");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("POOL_NOT_READY");
    expect(res.body.message).toMatch(/being prepared/);
  });

  test("a student never gets the same question twice", async () => {
    const id = await makePublished([MCQ, TF, SA], ["en"]);
    const student = await newStudent(id);
    const { attemptId } = await playThrough(app, request, id, student);
    const ids = await attemptPoolIds(attemptId);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(ids.length);
    const rows = (await pool.query("SELECT stem_hash, question_type FROM generated_questions WHERE attempt_id = $1", [attemptId])).rows;
    expect(new Set(rows.map((r) => r.stem_hash)).size).toBe(rows.length);
    // Served questions follow the blueprint's types.
    expect(rows.map((q) => q.question_type).sort()).toEqual(
      ["multiple_choice", "multiple_choice", "multiple_choice", "true_false", "true_false", "short_answer"].sort()
    );
  });

  test("30 students all receive different full question sets", async () => {
    const id = await makePublished([{ ...TF, question_count: 2 }], ["en"]);
    const sets = new Set();
    for (let i = 0; i < 30; i++) {
      const { attemptId } = await playThrough(app, request, id, await newStudent(id));
      const ids = await attemptPoolIds(attemptId);
      expect(ids).toHaveLength(2);
      sets.add(ids.sort((a, b) => a - b).join(","));
    }
    expect(sets.size).toBe(30);
  }, 120000);

  test("a one-question exam still gives 30 students 30 different questions", async () => {
    const id = await makePublished([{ ...MCQ, question_count: 1 }], ["en"]);
    const seen = new Set();
    for (let i = 0; i < 30; i++) {
      const res = await start(id, await newStudent(id));
      expect(res.status).toBe(200);
      seen.add((await attemptPoolIds(res.body.data.attemptId))[0]);
    }
    expect(seen.size).toBe(30);
  }, 120000);

  test("an empty bucket is filled on demand while the student waits", async () => {
    const id = await makePublished([{ ...TF, question_count: 1 }], ["en"]);
    await pool.query("UPDATE question_pool SET status = 'retired'");
    const res = await start(id, await newStudent(id));
    expect(res.status).toBe(200);
    expect(fakes.prompts.some((p) => p.purpose === "pool_on_demand")).toBe(true);
  });

  test("if on-demand generation fails, a nearby difficulty is served instead", async () => {
    const id = await makePublished([{ ...TF, question_count: 1 }], ["en"]);
    const { rows } = await pool.query("SELECT difficulty, objective_id FROM question_pool LIMIT 1");
    const { difficulty: wanted, objective_id: objectiveId } = rows[0];
    await pool.query("UPDATE question_pool SET status = 'retired'");
    await pool.query(
      `INSERT INTO question_pool (assessment_id, objective_id, question_type, difficulty, language, question_text, correct_answer, stem_hash)
       VALUES ($1, $2, 'true_false', $3, 'en', 'Fallback question about plants', 'true', repeat('a', 64))`,
      [id, objectiveId, wanted === 5 ? 4 : wanted + 1]
    );
    fakes.ai.question_generation = () => {
      throw new Error("LLM down");
    };
    const res = await start(id, await newStudent(id));
    expect(res.status).toBe(200);
    expect(res.body.data.question.question_text).toBe("Fallback question about plants");
  });

  test("with nothing to serve the student gets a clear 503, never a 500, and no attempt is created", async () => {
    const id = await makePublished([{ ...TF, question_count: 1 }], ["en"]);
    await pool.query("UPDATE question_pool SET status = 'retired'");
    fakes.ai.question_generation = () => {
      throw new Error("LLM down");
    };
    const res = await start(id, await newStudent(id));
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("POOL_EXHAUSTED");
    expect((await pool.query("SELECT count(*)::int AS n FROM assessment_attempts")).rows[0].n).toBe(0);
  });

  test("a bucket that runs short is topped up in the background", async () => {
    const id = await makePublished([{ ...TF, question_count: 1 }], ["en"]);
    await pool.query("UPDATE question_pool SET status = 'retired' WHERE id IN (SELECT id FROM question_pool ORDER BY id LIMIT 3)");
    queueAdapter.mode = "record";
    await start(id, await newStudent(id));
    expect(queueAdapter.recorded).toContainEqual({ name: "pool.fill", data: { assessmentId: id, language: "en" }, singletonKey: `pool-${id}-en` });
  });

  test("questions are counted as served", async () => {
    const id = await makePublished([{ ...TF, question_count: 2 }], ["en"]);
    await playThrough(app, request, id, await newStudent(id));
    const { rows } = await pool.query("SELECT sum(times_served)::int AS n FROM question_pool");
    expect(rows[0].n).toBe(2);
  });
});

// --------------------------------------------------------------------- bank

describe("question bank", () => {
  const bank = (id, path = "", method = "get", body, user = instructor) =>
    request(app)[method](`/api/assessments/${id}/questions${path}`).set("Authorization", auth(user)).send(body);

  test("browse with filters and pagination", async () => {
    const id = await makePublished([MCQ, TF], ["en", "ur"]);
    const all = await bank(id, "?page_size=5");
    expect(all.status).toBe(200);
    expect(all.body.data.items).toHaveLength(5);
    expect(all.body.data.total).toBeGreaterThan(5);
    const ur = await bank(id, "?language=ur&question_type=true_false&page_size=100");
    expect(ur.body.data.items.every((q) => q.language === "ur" && q.questionType === "true_false")).toBe(true);
    const page2 = await bank(id, "?page_size=5&page=2");
    expect(page2.body.data.items[0].id).not.toBe(all.body.data.items[0].id);
  });

  test("editing creates a new version; students who already got the old one keep it", async () => {
    const id = await makePublished([{ ...TF, question_count: 1 }], ["en"]);
    const res = await start(id, await newStudent(id));
    const servedPoolId = (await attemptPoolIds(res.body.data.attemptId))[0];
    const servedText = res.body.data.question.question_text;

    const edit = await bank(id, `/${servedPoolId}`, "put", { question_text: "Edited: plants need light", correct_answer: true });
    expect(edit.status).toBe(200);
    expect(edit.body.data).toMatchObject({ version: 2, previousVersionId: servedPoolId, questionText: "Edited: plants need light", approved: true });
    const old = (await pool.query("SELECT status FROM question_pool WHERE id = $1", [servedPoolId])).rows[0];
    expect(old.status).toBe("retired");
    const attemptCopy = (await pool.query("SELECT question_text FROM generated_questions WHERE attempt_id = $1", [res.body.data.attemptId])).rows[0];
    expect(attemptCopy.question_text).toBe(servedText);
    // Editing a retired version is refused.
    expect((await bank(id, `/${servedPoolId}`, "put", { question_text: "again", correct_answer: true })).status).toBe(409);
  });

  test("invalid edits and manual questions are rejected with a specific message", async () => {
    const id = await makePublished([MCQ], ["en"]);
    const q = (await bank(id, "?question_type=multiple_choice")).body.data.items[0];
    const bad = await bank(id, `/${q.id}`, "put", { question_text: "Which?", options: ["a", "b", "c", "d"], correct_answer: "z" });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/one of the options/);
    const dup = await bank(id, `/${q.id}`, "put", { question_text: "Which?", options: ["a", "a", "c", "d"], correct_answer: "a" });
    expect(dup.body.message).toMatch(/different/);
  });

  test("add a manual question, approve, retire and regenerate one", async () => {
    const id = await makePublished([MCQ], ["en"]);
    const objectiveId = (await pool.query("SELECT id FROM learning_objectives WHERE assessment_id = $1 LIMIT 1", [id])).rows[0].id;
    const added = await bank(id, "", "post", {
      objective_id: objectiveId,
      question_type: "multiple_choice",
      difficulty: 2,
      language: "en",
      question_text: "Which gas do plants absorb?",
      options: ["Oxygen", "Carbon dioxide", "Helium", "Neon"],
      correct_answer: "Carbon dioxide",
    });
    expect(added.status).toBe(201);
    expect(added.body.data).toMatchObject({ origin: "manual", approved: true, difficulty: 2 });
    const again = await bank(id, "", "post", { ...added.body.data, objective_id: objectiveId, question_type: "multiple_choice", question_text: "Which gas do plants absorb?", correct_answer: "Carbon dioxide", language: "en", difficulty: 2 });
    expect(again.status).toBe(409);

    const ai = (await bank(id, "?page_size=100")).body.data.items.find((x) => x.origin === "ai");
    expect((await bank(id, `/${ai.id}/approve`, "post")).body.data.approved).toBe(true);
    const regen = await bank(id, `/${ai.id}/regenerate`, "post");
    expect(regen.status).toBe(200);
    expect(regen.body.data).toMatchObject({ version: 2, previousVersionId: ai.id, questionType: ai.questionType, difficulty: ai.difficulty });
    expect(regen.body.data.questionText).not.toBe(ai.questionText);

    const del = await bank(id, `/${added.body.data.id}`, "delete");
    expect(del.status).toBe(200);
    const retired = await bank(id, "?status=retired&page_size=100");
    expect(retired.body.data.items.map((x) => x.id)).toEqual(expect.arrayContaining([added.body.data.id, ai.id]));
  });

  test("the bank is owner-only and needs objectives first", async () => {
    const id = await createDraft([TF]);
    const other = await createUser({ role: "instructor" });
    expect((await bank(id, "", "get", undefined, other)).status).toBe(403);
    await pool.query("UPDATE assessments SET status = 'draft' WHERE id = $1", [id]);
    expect((await bank(id)).status).toBe(409);
  });
});

describe("student availability", () => {
  test("the dashboard and attempt state list only languages that are ready", async () => {
    const id = await createDraft([TF]);
    const student = await newStudent(id);
    const list = async () =>
      (await request(app).get("/api/student-analytics/assessments").set("Authorization", auth(student))).body.data.find((a) => a.id === id);
    const state = async () => (await request(app).get(`/api/taking/assessments/${id}/attempt`).set("Authorization", auth(student))).body.data;

    expect((await list()).available_languages).toEqual([]);
    expect((await state()).availableLanguages).toEqual([]);
    await publish(id, ["en", "ur"]);
    expect((await list()).available_languages).toEqual(["en", "ur"]);
    expect((await state()).availableLanguages).toEqual(["en", "ur"]);
  });
});
