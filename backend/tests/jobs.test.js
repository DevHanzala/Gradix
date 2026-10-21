import { defineJob, enqueue, queueAdapter } from "../jobs/index.js";
import { generateContent, aiAdapter, estimateTokens } from "../services/ai/generateContent.js";
import { pool, resetDatabase, createUser, createAssessment, installFakes } from "./helpers.js";

beforeEach(async () => {
  await resetDatabase();
  installFakes();
  queueAdapter.mode = "inline";
  queueAdapter.recorded.length = 0;
});

afterAll(async () => {
  await pool.end();
});

describe("background jobs", () => {
  test("inline mode retries a failing job until it succeeds", async () => {
    let calls = 0;
    defineJob("test.flaky", async () => {
      calls += 1;
      if (calls < 3) throw new Error("transient");
      return "ok";
    }, { retryLimit: 4 });
    await enqueue("test.flaky", {});
    expect(calls).toBe(3);
  });

  test("a job that keeps failing stops after retryLimit + 1 attempts and does not throw", async () => {
    let calls = 0;
    defineJob("test.broken", async () => {
      calls += 1;
      throw new Error("permanent");
    }, { retryLimit: 2 });
    await expect(enqueue("test.broken", {})).resolves.toBeDefined();
    expect(calls).toBe(3);
  });

  test("record mode only records jobs", async () => {
    let ran = false;
    defineJob("test.recorded", async () => {
      ran = true;
    });
    queueAdapter.mode = "record";
    await enqueue("test.recorded", { id: 7 }, { singletonKey: "a-7" });
    expect(ran).toBe(false);
    expect(queueAdapter.recorded).toEqual([{ name: "test.recorded", data: { id: 7 }, singletonKey: "a-7" }]);
  });

  test("stately jobs must have a singletonKey", async () => {
    defineJob("test.stately", async () => {}, { policy: "stately" });
    await expect(enqueue("test.stately", {})).rejects.toThrow(/singletonKey/);
    await expect(enqueue("test.stately", {}, { singletonKey: "a-1" })).resolves.toBeDefined();
  });

  test("unknown jobs are rejected", async () => {
    await expect(enqueue("test.nope", {})).rejects.toThrow(/Unknown job/);
  });

  test("the prune job removes only old usage rows", async () => {
    await pool.query(
      `INSERT INTO llm_usage_log (purpose, provider, latency_ms, success, created_at)
       VALUES ('x', 'p', 1, true, NOW() - INTERVAL '400 days'), ('y', 'p', 1, true, NOW())`
    );
    await enqueue("maintenance.prune-llm-log", {});
    const { rows } = await pool.query(`SELECT purpose FROM llm_usage_log`);
    expect(rows.map((r) => r.purpose)).toEqual(["y"]);
  });
});

describe("LLM usage log", () => {
  const rows = async () => (await pool.query(`SELECT * FROM llm_usage_log ORDER BY id`)).rows;

  test("every call is logged with purpose, ids, latency and estimated tokens", async () => {
    const instructor = await createUser({ role: "instructor" });
    const assessment = await createAssessment(instructor);
    aiAdapter.generate = async () => "hello world";
    const text = await generateContent("Write something", { purpose: "unit_test", assessmentId: assessment.id, userId: instructor.id });
    expect(text).toBe("hello world");
    const [row] = await rows();
    expect(row).toMatchObject({
      purpose: "unit_test",
      assessment_id: assessment.id,
      user_id: instructor.id,
      success: true,
      tokens_estimated: true,
      input_tokens: estimateTokens("Write something"),
      output_tokens: estimateTokens("hello world"),
    });
    expect(row.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test("real provider usage is stored, and each attempt (failed primary + fallback) gets a row", async () => {
    aiAdapter.generate = async () => ({
      text: "answer",
      attempts: [
        { provider: "gemini", model: "m1", latencyMs: 30, success: false, error: "quota" },
        { provider: "groq", model: "m2", latencyMs: 40, success: true, inputTokens: 120, outputTokens: 33 },
      ],
    });
    await generateContent("p", { purpose: "question_generation" });
    const logged = await rows();
    expect(logged).toHaveLength(2);
    expect(logged[0]).toMatchObject({ provider: "gemini", success: false, error: "quota" });
    expect(logged[1]).toMatchObject({ provider: "groq", model: "m2", success: true, input_tokens: 120, output_tokens: 33, tokens_estimated: false });
  });

  test("failed calls are logged and the error still propagates", async () => {
    aiAdapter.generate = async () => {
      throw new Error("all providers down");
    };
    await expect(generateContent("p", { purpose: "question_generation" })).rejects.toThrow("all providers down");
    const [row] = await rows();
    expect(row).toMatchObject({ success: false, error: "all providers down" });
  });
});
