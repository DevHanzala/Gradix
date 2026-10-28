import request from "supertest";
import app from "../app.js";
import { queueAdapter } from "../jobs/queue.js";
import { recoverStuckWork } from "../jobs/index.js";
import { listCreationKeys, resetProviderKeys, setClientForTests } from "../services/ai/aiProviders.js";
import { generateWithProviders, generateContent, aiAdapter } from "../services/ai/generateContent.js";
import { classifyRateLimit, keyStatus, pickKeys, resetKeyPoolState } from "../services/ai/keyPool.js";
import { pool, resetDatabase, createUser, createAssessment, auth, installFakes } from "./helpers.js";

const KEY_ENV = ["GEMINI_CREATION_API_KEY_1", "GEMINI_CREATION_API_KEY_2", "GEMINI_CREATION_API_KEY_3", "GROQ_API_KEY", "GROQ_API_KEY_2"];
const saved = Object.fromEntries(KEY_ENV.map((k) => [k, process.env[k]]));

/** Fake API clients: each key answers or fails as `plan[label]` says; calls are recorded. */
let calls;
const geminiClient = (label, plan) => ({
  models: {
    generateContent: async () => {
      calls.push(label);
      if (plan[label] instanceof Error) throw plan[label];
      return { text: `answer from ${label}`, usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 } };
    },
  },
});
const groqClient = (label, plan) => ({
  chat: {
    completions: {
      create: async () => {
        calls.push(label);
        if (plan[label] instanceof Error) throw plan[label];
        return { choices: [{ message: { content: `answer from ${label}` } }], usage: { prompt_tokens: 80, completion_tokens: 40 } };
      },
    },
  },
});
const useKeys = (env, plan = {}) => {
  for (const k of KEY_ENV) delete process.env[k];
  Object.assign(process.env, env);
  resetProviderKeys();
  resetKeyPoolState();
  for (const key of listCreationKeys()) {
    setClientForTests(key.label, key.type === "gemini" ? geminiClient(key.label, plan) : groqClient(key.label, plan));
  }
};
const rateLimit = (message) => Object.assign(new Error(message), { status: 429 });
const logUsage = (label, model, n, { tokens = 10, error = null } = {}) =>
  pool.query(
    `INSERT INTO llm_usage_log (purpose, provider, model, key_label, input_tokens, output_tokens, latency_ms, success, error)
     SELECT 'question_generation', $1, $2, $3, $4, 0, 100, $5, $6 FROM generate_series(1, $7)`,
    [label.startsWith("groq") ? "groq" : "gemini", model, label, tokens, !error, error, n]
  );

let fakes;
beforeEach(async () => {
  await resetDatabase();
  fakes = installFakes();
  queueAdapter.mode = "inline";
  calls = [];
});

afterAll(async () => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetProviderKeys();
  resetKeyPoolState();
  await pool.end();
});

describe("API keys", () => {
  test("every numbered Gemini and Groq key is used, with labels and no duplicates", () => {
    useKeys({ GEMINI_CREATION_API_KEY_1: "a", GEMINI_CREATION_API_KEY_3: "c", GROQ_API_KEY: "g", GROQ_API_KEY_2: "a" });
    // The same secret twice is one quota: the second (GROQ_API_KEY_2 = "a") is dropped.
    expect(listCreationKeys().map((k) => k.label)).toEqual(["gemini-1", "gemini-3", "groq-1"]);
    expect(JSON.stringify(listCreationKeys().map(({ label, model }) => ({ label, model })))).not.toContain('"a"');
  });

  test("rate-limit errors are recognised, daily ones separately", () => {
    expect(classifyRateLimit(rateLimit("Quota exceeded for GenerateRequestsPerDayPerProjectPerModel-FreeTier"))).toBe("daily");
    expect(classifyRateLimit(rateLimit("Rate limit reached on tokens per day (TPD)"))).toBe("daily");
    expect(classifyRateLimit(rateLimit("Rate limit reached on requests per minute (RPM)"))).toBe("minute");
    expect(classifyRateLimit(new Error("Empty Gemini response"))).toBeNull();
  });

  test("calls are spread over the keys and logged with the key label", async () => {
    useKeys({ GEMINI_CREATION_API_KEY_1: "a", GEMINI_CREATION_API_KEY_2: "b", GROQ_API_KEY: "g" });
    aiAdapter.generate = generateWithProviders;
    for (let i = 0; i < 30; i++) await generateContent("hello", { purpose: "question_generation" });
    const { rows } = await pool.query(`SELECT key_label, count(*)::int AS n FROM llm_usage_log GROUP BY 1 ORDER BY 1`);
    expect(rows.map((r) => r.key_label)).toEqual(["gemini-1", "gemini-2", "groq-1"]);
    expect(rows.every((r) => r.n >= 3)).toBe(true);
  });

  test("a key that is out of free quota today is skipped", async () => {
    useKeys({ GEMINI_CREATION_API_KEY_1: "a", GROQ_API_KEY: "g" });
    await logUsage("gemini-1", "gemini-2.5-flash", 250); // Gemini free plan: 250 requests/day
    const status = await keyStatus({ fresh: true });
    expect(status.find((k) => k.label === "gemini-1")).toMatchObject({ status: "exhausted", left: { requests: 0 } });
    expect((await pickKeys())[0].label).toBe("groq-1");
  });

  test("a daily rate limit parks the key until its reset; the call succeeds on another key", async () => {
    useKeys(
      { GEMINI_CREATION_API_KEY_1: "a", GROQ_API_KEY: "g" },
      { "gemini-1": rateLimit("Quota exceeded: GenerateRequestsPerDayPerProjectPerModel-FreeTier") }
    );
    aiAdapter.generate = generateWithProviders;
    // Keys are shuffled: call until gemini-1 has been tried once.
    for (let i = 0; i < 60 && !calls.includes("gemini-1"); i++) {
      expect(await generateContent("hello", { purpose: "practice" })).toBe("answer from groq-1");
    }
    expect(calls).toContain("gemini-1");
    // After the daily 429 it is parked: further calls never try it.
    for (let i = 0; i < 10; i++) expect(await generateContent("hello", { purpose: "practice" })).toBe("answer from groq-1");
    expect(calls.filter((c) => c === "gemini-1")).toHaveLength(1);
    const gemini = (await keyStatus({ fresh: true })).find((k) => k.label === "gemini-1");
    expect(gemini.status).toBe("exhausted");
    expect(new Date(gemini.blockedUntil).getTime()).toBeGreaterThan(Date.now());
    // Refused calls do not count as used quota.
    expect(gemini.today.requests).toBe(0);
  });

  test("when every key fails, the last error is raised and every attempt is logged", async () => {
    useKeys({ GEMINI_CREATION_API_KEY_1: "a", GROQ_API_KEY: "g" }, { "gemini-1": new Error("boom 1"), "groq-1": new Error("boom 2") });
    aiAdapter.generate = generateWithProviders;
    await expect(generateContent("hello", { purpose: "practice" })).rejects.toThrow(/boom/);
    const { rows } = await pool.query(`SELECT key_label, success FROM llm_usage_log ORDER BY key_label`);
    expect(rows).toEqual([
      { key_label: "gemini-1", success: false },
      { key_label: "groq-1", success: false },
    ]);
  });

  test("image calls only use Gemini keys", async () => {
    useKeys({ GEMINI_CREATION_API_KEY_1: "a", GROQ_API_KEY: "g" });
    for (let i = 0; i < 10; i++) expect((await pickKeys({ needsImages: true })).map((k) => k.type)).toEqual(["gemini"]);
  });
});

describe("super admin AI usage", () => {
  test("tokens per day and each key's usage against its free limits; no cost", async () => {
    useKeys({ GEMINI_CREATION_API_KEY_1: "a", GROQ_API_KEY: "g" });
    await logUsage("gemini-1", "gemini-2.5-flash", 5, { tokens: 1000 });
    await logUsage("groq-1", "openai/gpt-oss-20b", 3, { tokens: 60000 });
    await logUsage("groq-1", "openai/gpt-oss-20b", 2, { tokens: 0, error: "429 Rate limit reached on requests per minute" });
    const superAdmin = await createUser({ role: "super_admin" });
    const res = await request(app).get("/api/admin/stats?days=7").set("Authorization", auth(superAdmin));
    expect(res.status).toBe(200);
    const { llm } = res.body.data;
    expect(JSON.stringify(llm)).not.toMatch(/cost|price/i);
    expect(llm.daily).toHaveLength(7);
    expect(llm.daily.at(-1).tokens).toBe(5 * 1000 + 3 * 60000);
    const gemini = llm.keys.find((k) => k.label === "gemini-1");
    expect(gemini).toMatchObject({ provider: "gemini", today: { requests: 5, tokens: 5000 }, left: { requests: 245, tokens: null }, status: "ok" });
    const groq = llm.keys.find((k) => k.label === "groq-1");
    // The 2 rate-limited calls are not counted as used requests.
    expect(groq).toMatchObject({ today: { requests: 3, tokens: 180000 }, left: { requests: 997, tokens: 20000 }, status: "low" });
    expect(groq.resetsAt).toBeTruthy();
    expect(llm.keys.every((k) => !("secret" in k))).toBe(true);
    expect(llm.today).toMatchObject({ requests: 8, tokens: 185000, keysAvailable: 2 });
  });
});

describe("background work never stays stuck", () => {
  const instructorAndAssessment = async () => {
    const instructor = await createUser({ role: "instructor" });
    const assessment = await createAssessment(instructor);
    return { instructor, assessment };
  };

  test("assessments still extracting objectives and pools still filling are re-queued", async () => {
    const { assessment } = await instructorAndAssessment();
    await pool.query(`UPDATE assessments SET objectives_state = 'extracting', updated_at = NOW() - interval '10 minutes' WHERE id = $1`, [assessment.id]);
    await pool.query(
      `INSERT INTO pool_language_state (assessment_id, language, state, updated_at) VALUES ($1, 'ur', 'filling', NOW() - interval '10 minutes')`,
      [assessment.id]
    );
    queueAdapter.mode = "record";
    queueAdapter.recorded = [];
    const recovered = await recoverStuckWork({ olderThanMinutes: 5 });
    expect(recovered).toEqual({ objectives: [assessment.id], pools: [`${assessment.id}/ur`] });
    expect(queueAdapter.recorded.map((j) => [j.name, j.singletonKey])).toEqual([
      ["objectives.extract", `assessment-${assessment.id}`],
      ["pool.fill", `pool-${assessment.id}-ur`],
    ]);
    // Recent work is left alone by the periodic check.
    queueAdapter.recorded = [];
    await pool.query(`UPDATE assessments SET updated_at = NOW() WHERE id = $1`, [assessment.id]);
    await pool.query(`UPDATE pool_language_state SET updated_at = NOW()`);
    expect(await recoverStuckWork({ olderThanMinutes: 5 })).toEqual({ objectives: [], pools: [] });
  });

  test("a stalled extraction is flagged so the instructor can retry it", async () => {
    const { instructor, assessment } = await instructorAndAssessment();
    await pool.query(`UPDATE assessments SET objectives_state = 'extracting', updated_at = NOW() - interval '10 minutes' WHERE id = $1`, [assessment.id]);
    const res = await request(app).get(`/api/assessments/${assessment.id}/objectives`).set("Authorization", auth(instructor));
    expect(res.body.data).toMatchObject({ objectivesState: "extracting", objectivesStalled: true });

    // Retrying runs the extraction again (inline queue here) and clears the flag.
    const retry = await request(app).post(`/api/assessments/${assessment.id}/objectives/regenerate`).set("Authorization", auth(instructor));
    expect(retry.status).toBeLessThan(300);
    const after = await request(app).get(`/api/assessments/${assessment.id}/objectives`).set("Authorization", auth(instructor));
    expect(after.body.data.objectivesStalled).toBe(false);
    expect(after.body.data.objectivesState).not.toBe("extracting");
    expect(fakes.prompts.some((p) => p.purpose === "objective_extraction")).toBe(true);
  });
});
