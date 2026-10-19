import request from "supertest";
import app from "../app.js";
import { replayDifficulty, computeScores, performance, ADAPTIVE_CONFIG } from "../services/engine/adaptiveConfig.js";
import { GRACE_MS } from "../services/studentAssessment.service.js";
import { queueAdapter } from "../jobs/queue.js";
import { pool, resetDatabase, createUser, auth, installFakes, enroll, shiftAttemptTime } from "./helpers.js";

let instructor;

beforeEach(async () => {
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
  instructor = await createUser({ role: "instructor" });
});

afterAll(async () => {
  await pool.end();
});

// ------------------------------------------------------------------ units

const answer = (correct, ratio = 0.2, extra = {}) => ({ correct, timedOut: false, timeTaken: ratio * 60, timeAllowed: 60, ...extra });

describe("adaptive difficulty rules", () => {
  test("everyone starts at medium difficulty", () => {
    expect(replayDifficulty([]).next).toBe(3);
  });

  test("two fast correct answers move up; two wrong answers move down", () => {
    expect(replayDifficulty([answer(true), answer(true)]).next).toBe(4);
    expect(replayDifficulty([answer(false), answer(false)]).next).toBe(2);
  });

  test("one answer is not enough evidence to move", () => {
    expect(replayDifficulty([answer(true)]).next).toBe(3);
  });

  test("a timeout counts as wrong even if nothing was answered", () => {
    expect(performance(answer(false, 1, { timedOut: true }))).toBe(0);
    expect(replayDifficulty([answer(false, 1, { timedOut: true }), answer(false, 1, { timedOut: true })]).next).toBe(2);
  });

  test("a correct but very slow answer is worth less than a fast one", () => {
    expect(performance(answer(true, 0.3))).toBe(1);
    expect(performance(answer(true, 1))).toBeCloseTo(1 - ADAPTIVE_CONFIG.SLOW_PENALTY);
    // Slow-correct answers alone do not push the level up (0.7 < 0.75).
    expect(replayDifficulty([answer(true, 1), answer(true, 1)]).next).toBe(3);
  });

  test("difficulty stays within 1..5 and each change needs fresh evidence", () => {
    const allRight = Array.from({ length: 20 }, () => answer(true));
    const allWrong = Array.from({ length: 20 }, () => answer(false));
    expect(replayDifficulty(allRight).next).toBe(5);
    expect(replayDifficulty(allWrong).next).toBe(1);
    const path = replayDifficulty(allRight.slice(0, 4)).path.map((p) => p.next);
    expect(path).toEqual([3, 4, 4, 5]); // after moving to 4 the window restarts
  });

  test("the path is deterministic", () => {
    const history = [answer(true), answer(false), answer(true), answer(true), answer(false)];
    expect(replayDifficulty(history)).toEqual(replayDifficulty(history));
  });
});

describe("weighted scoring", () => {
  const q = (difficulty, correct, positive = 1, score = correct ? positive : 0) => ({ difficulty, correct, positiveMarks: positive, score });

  test("all correct on a fixed 10/20/40/20/10 mix is exactly 100%", () => {
    const mix = [1, 2, 2, 3, 3, 3, 3, 4, 4, 5].map((d) => q(d, true));
    expect(computeScores(mix)).toMatchObject({ rawPercentage: 100, adjustedPercentage: 100, adjustedScore: 10 });
  });

  test("all correct on easy questions only is below 100%", () => {
    const easy = [1, 1, 1, 1].map((d) => q(d, true));
    expect(computeScores(easy)).toMatchObject({ rawPercentage: 100, adjustedPercentage: 60 });
  });

  test("hard correct answers are capped at 100% but the uncapped score is kept", () => {
    expect(computeScores([q(5, true), q(5, true)])).toMatchObject({ adjustedScore: 2.8, adjustedPercentage: 100 });
  });

  test("wrong answers lose their unweighted negative marks; totals are floored at 0", () => {
    const res = computeScores([q(5, true), { difficulty: 1, correct: false, positiveMarks: 1, score: -0.5 }]);
    expect(res).toMatchObject({ rawScore: 0.5, adjustedScore: 0.9 });
    expect(computeScores([{ difficulty: 3, correct: false, positiveMarks: 1, score: -1 }]).rawScore).toBe(0);
  });
});

// ------------------------------------------------------------ integration

const LESSON = Array.from({ length: 40 }, (_, i) => `Fact ${i}: plants make sugar from light and water in their leaves.`).join(" ");
const TF = (count) => ({ question_type: "true_false", question_count: count, duration_per_question: 60, positive_marks: 1, negative_marks: 0 });

const createPublished = async ({ adaptive = true, showLive = false, count = 6 } = {}) => {
  const res = await request(app)
    .post("/api/assessments")
    .set("Authorization", auth(instructor))
    .field("title", "Plants")
    .field("prompt", "Photosynthesis")
    .field("adaptive", String(adaptive))
    .field("show_live_score", String(showLive))
    .field("question_blocks", JSON.stringify([TF(count)]))
    .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
  const id = res.body.data.id;
  expect((await request(app).post(`/api/assessments/${id}/publish`).set("Authorization", auth(instructor)).send({ languages: ["en"] })).status).toBe(202);
  return id;
};
const newStudent = async (id) => {
  const s = await createUser({ role: "student" });
  await enroll({ id }, s);
  return s;
};
const start = (id, s) => request(app).post(`/api/taking/assessments/${id}/start`).set("Authorization", auth(s)).send({ language: "en" });
const save = (attemptId, qid, value, s) => request(app).put(`/api/taking/attempts/${attemptId}/answers/${qid}`).set("Authorization", auth(s)).send({ answer: value });
const advance = (attemptId, from, s) => request(app).post(`/api/taking/attempts/${attemptId}/advance`).set("Authorization", auth(s)).send({ fromIndex: from });
const state = (id, s) => request(app).get(`/api/taking/assessments/${id}/attempt`).set("Authorization", auth(s));
const correctOf = async (qid) => (await pool.query("SELECT correct_answer FROM generated_questions WHERE id = $1", [qid])).rows[0].correct_answer;
const rowCount = async (attemptId) => (await pool.query("SELECT count(*)::int AS n FROM generated_questions WHERE attempt_id = $1", [attemptId])).rows[0].n;

/** Answer every question right (or wrong) and return the served difficulties. */
const play = async (id, s, decide) => {
  let current = (await start(id, s)).body.data;
  const attemptId = current.attemptId;
  for (let i = 0; i < current.totalQuestions; i++) {
    const right = await correctOf(current.question.id);
    await save(attemptId, current.question.id, decide(i) ? right : !right, s);
    const next = (await advance(attemptId, i, s)).body.data;
    if (next.finished) return { attemptId, result: next.result };
    current = next;
  }
  throw new Error("exam did not finish");
};

describe("one question at a time", () => {
  test("the next question does not exist anywhere before it is served", async () => {
    const id = await createPublished();
    const s = await newStudent(id);
    const started = (await start(id, s)).body.data;
    expect(started.totalQuestions).toBe(6);
    expect(await rowCount(started.attemptId)).toBe(1);
    await save(started.attemptId, started.question.id, true, s);
    const next = (await advance(started.attemptId, 0, s)).body.data;
    expect(next.currentQuestionIndex).toBe(1);
    expect(next.question.id).not.toBe(started.question.id);
    expect(await rowCount(started.attemptId)).toBe(2);
  });

  test("each answer is graded when its question closes, with answered_at and time taken", async () => {
    const id = await createPublished();
    const s = await newStudent(id);
    const started = (await start(id, s)).body.data;
    await save(started.attemptId, started.question.id, await correctOf(started.question.id), s);
    await advance(started.attemptId, 0, s);
    const { rows } = await pool.query("SELECT is_correct, score, answered_at, time_taken_seconds, graded_at FROM student_answers WHERE question_id = $1", [started.question.id]);
    expect(rows[0]).toMatchObject({ is_correct: true, score: 1 });
    expect(rows[0].answered_at).toBeTruthy();
    expect(rows[0].graded_at).toBeTruthy();
    expect(rows[0].time_taken_seconds).toBeGreaterThanOrEqual(0);
    expect(rows[0].time_taken_seconds).toBeLessThan(60);
  });

  test("correctness is never sent while the attempt runs (live score off)", async () => {
    const id = await createPublished();
    const s = await newStudent(id);
    const started = (await start(id, s)).body.data;
    await save(started.attemptId, started.question.id, true, s);
    const next = (await advance(started.attemptId, 0, s)).body;
    const text = JSON.stringify(next) + JSON.stringify((await state(id, s)).body);
    expect(text).not.toMatch(/correct|"liveScore"|lastAnswer/i);
    expect(text).toContain('"showLiveScore":false');
  });

  test("with 'show live score' on, the student sees each result and a running score", async () => {
    const id = await createPublished({ showLive: true });
    const s = await newStudent(id);
    const started = (await start(id, s)).body.data;
    await save(started.attemptId, started.question.id, await correctOf(started.question.id), s);
    const next = (await advance(started.attemptId, 0, s)).body.data;
    expect(next.lastAnswer).toEqual({ correct: true, score: 1 });
    expect(next.liveScore).toEqual({ score: 1, answered: 1, correct: 1 });
  });
});

describe("adaptive path", () => {
  test("a strong student climbs, a weak student descends, both covering the same objectives in the same order", async () => {
    const id = await createPublished({ count: 8 });
    const strong = await play(id, await newStudent(id), () => true);
    const weak = await play(id, await newStudent(id), () => false);

    const served = async (attemptId) =>
      (await pool.query("SELECT difficulty, objective_id FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order", [attemptId])).rows;
    const strongRows = await served(strong.attemptId);
    const weakRows = await served(weak.attemptId);

    expect(strongRows[0].difficulty).toBe(3);
    expect(strongRows.at(-1).difficulty).toBeGreaterThan(3);
    expect(weakRows.at(-1).difficulty).toBeLessThan(3);
    expect(strongRows.map((r) => r.objective_id)).toEqual(weakRows.map((r) => r.objective_id));
    const blueprint = (await pool.query("SELECT blueprint FROM assessments WHERE id = $1", [id])).rows[0].blueprint;
    expect(strongRows.map((r) => r.objective_id)).toEqual(blueprint.slots.map((slot) => slot.objective_id));

    expect(strong.result.adaptive).toBe(true);
    expect(strong.result.rawPercentage).toBe(100);
    expect(strong.result.adjustedPercentage).toBe(100);
    expect(strong.result.difficultyPath).toHaveLength(8);
    expect(weak.result.rawPercentage).toBe(0);
    const stored = (await pool.query("SELECT raw_score, adjusted_score, difficulty_path FROM assessment_attempts WHERE id = $1", [strong.attemptId])).rows[0];
    expect(stored.raw_score).toBe(8);
    expect(stored.adjusted_score).toBeGreaterThan(8);
    expect(stored.difficulty_path[0]).toMatchObject({ target: 3, correct: true });
  }, 60000);

  test("a non-adaptive pool assessment serves the blueprint's fixed difficulties", async () => {
    const id = await createPublished({ adaptive: false, count: 5 });
    const { attemptId } = await play(id, await newStudent(id), () => true);
    const served = (await pool.query("SELECT difficulty FROM generated_questions WHERE attempt_id = $1 ORDER BY question_order", [attemptId])).rows.map((r) => r.difficulty);
    const blueprint = (await pool.query("SELECT blueprint FROM assessments WHERE id = $1", [id])).rows[0].blueprint;
    expect(served).toEqual(blueprint.slots.map((slot) => slot.difficulty));
  }, 60000);

  test("an unanswered question that times out counts as wrong and lowers the next difficulty", async () => {
    const id = await createPublished();
    const s = await newStudent(id);
    let current = (await start(id, s)).body.data;
    for (let i = 0; i < 2; i++) {
      // Let the window run out without answering.
      await shiftAttemptTime(current.attemptId, 60 + GRACE_MS / 1000 + 1);
      current = (await state(id, s)).body.data;
    }
    const { rows } = await pool.query(
      `SELECT gq.difficulty, sa.timed_out, sa.is_correct FROM generated_questions gq
       LEFT JOIN student_answers sa ON sa.question_id = gq.id WHERE gq.attempt_id = $1 ORDER BY gq.question_order`,
      [current.attemptId]
    );
    expect(rows[0]).toMatchObject({ timed_out: true, is_correct: false });
    expect(rows[1]).toMatchObject({ timed_out: true, is_correct: false });
    expect(rows[2].difficulty).toBe(2);
  });
});

describe("resume and integrity", () => {
  test("refresh or Start again resumes the same current question and keeps the saved answer", async () => {
    const id = await createPublished();
    const s = await newStudent(id);
    const first = (await start(id, s)).body.data;
    await save(first.attemptId, first.question.id, true, s);
    const second = (await advance(first.attemptId, 0, s)).body.data;

    const resumed = await start(id, s);
    expect(resumed.body.code).toBe("IN_PROGRESS");
    expect(resumed.body.data.question.id).toBe(second.question.id);
    expect(resumed.body.data.currentQuestionIndex).toBe(1);
    expect(await rowCount(first.attemptId)).toBe(2); // resuming never serves an extra question

    // A repeated advance for an already-closed index changes nothing.
    const repeat = (await advance(first.attemptId, 0, s)).body.data;
    expect(repeat.question.id).toBe(second.question.id);
  });

  test("submitting early: unreached questions still count in the total marks", async () => {
    const id = await createPublished({ count: 4 });
    const s = await newStudent(id);
    const started = (await start(id, s)).body.data;
    await save(started.attemptId, started.question.id, await correctOf(started.question.id), s);
    const res = await request(app)
      .post(`/api/taking/assessments/${id}/submit`)
      .set("Authorization", auth(s))
      .send({ attemptId: started.attemptId });
    expect(res.body.data).toMatchObject({ score: 1, totalMarks: 4, percentage: 25, rawPercentage: 25, notReachedCount: 3, unansweredCount: 3 });
  });

  test("windows that passed while the student was away are not reached; the open one is served", async () => {
    const id = await createPublished({ count: 5 });
    const s = await newStudent(id);
    const started = (await start(id, s)).body.data;
    await shiftAttemptTime(started.attemptId, 60 * 2 + 30);
    const res = await state(id, s);
    expect(res.body).toMatchObject({ success: true });
    const now = res.body.data;
    expect(now.status).toBe("in_progress");
    expect(now.currentQuestionIndex).toBe(2);
    expect(now.questionRemainingSeconds).toBeLessThanOrEqual(31);
    expect(await rowCount(started.attemptId)).toBe(2); // slot 2 served late, slot 1 never shown
  });

  test("two parallel advances serve only one next question", async () => {
    const id = await createPublished();
    const s = await newStudent(id);
    const started = (await start(id, s)).body.data;
    await Promise.all([advance(started.attemptId, 0, s), advance(started.attemptId, 0, s)]);
    expect(await rowCount(started.attemptId)).toBe(2);
    expect((await state(id, s)).body.data.currentQuestionIndex).toBe(1);
  });
});

describe("adaptive toggle", () => {
  test("switching adaptive on a draft re-plans the blueprint without losing objectives", async () => {
    const res = await request(app)
      .post("/api/assessments")
      .set("Authorization", auth(instructor))
      .field("title", "Plants")
      .field("prompt", "Photosynthesis")
      .field("question_blocks", JSON.stringify([TF(4)]))
      .attach("files", Buffer.from(LESSON), { filename: "lesson.txt", contentType: "text/plain" });
    const id = res.body.data.id;
    const before = (await pool.query("SELECT blueprint FROM assessments WHERE id = $1", [id])).rows[0].blueprint;
    expect(before.adaptive).toBe(false);
    const objectives = (await pool.query("SELECT id FROM learning_objectives WHERE assessment_id = $1", [id])).rows;
    const resourceIds = (await pool.query("SELECT resource_id FROM assessment_resources WHERE assessment_id = $1", [id])).rows.map((r) => r.resource_id);

    const put = await request(app)
      .put(`/api/assessments/${id}`)
      .set("Authorization", auth(instructor))
      .send({ title: "Plants", prompt: "Photosynthesis", selected_resources: resourceIds, adaptive: true });
    expect(put.status).toBe(200);
    const after = (await pool.query("SELECT blueprint, adaptive FROM assessments WHERE id = $1", [id])).rows[0];
    expect(after.adaptive).toBe(true);
    expect(after.blueprint.adaptive).toBe(true);
    expect(after.blueprint.slots.every((s) => s.difficulty === null)).toBe(true);
    expect((await pool.query("SELECT id FROM learning_objectives WHERE assessment_id = $1", [id])).rows).toEqual(objectives);
  });
});
