import db from "../../DB/db.js";
import { getRandomCreationProvider, getCheckingModel } from "./aiProviders.js";

/**
 * THE single entry point for every LLM call in Gradix.
 * Every call (each provider attempt) is written to llm_usage_log with
 * purpose, provider, model, tokens, latency and success.
 */

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GROQ_MODEL = "openai/gpt-oss-20b";

/** Rough token estimate when a provider does not report usage. */
export const estimateTokens = (text) => Math.max(1, Math.ceil(String(text || "").length / 4));

const callGemini = async (client, prompt, options) => {
  const parts = [{ text: prompt }];
  for (const image of options.images || []) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts }],
    // @google/genai reads generation options from `config`.
    config: {
      maxOutputTokens: options.maxOutputTokens || 3000,
      temperature: options.temperature ?? 0.7,
      topP: options.topP ?? 0.9,
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const text = response.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  const usage = response.usageMetadata || {};
  return {
    text,
    provider: "gemini",
    model: GEMINI_MODEL,
    inputTokens: usage.promptTokenCount ?? null,
    outputTokens: usage.candidatesTokenCount ?? null,
  };
};

const callGroq = async (client, prompt, options) => {
  if (options.images?.length) throw new Error("Groq provider does not accept images");
  const response = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxOutputTokens || 3000,
  });
  const text = response?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty Groq response");
  return {
    text,
    provider: "groq",
    model: GROQ_MODEL,
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
  };
};

const callProvider = (provider, prompt, options) =>
  provider.type === "gemini" ? callGemini(provider.client, prompt, options) : callGroq(provider.client, prompt, options);

const timed = async (fn) => {
  const started = Date.now();
  try {
    return { ok: true, value: await fn(), latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error, latencyMs: Date.now() - started };
  }
};

/**
 * Real implementation: returns { text, attempts: [...] }.
 * `purpose === "checking"`-style calls use the checking key; everything else
 * uses the creation pool with one fallback attempt on another provider.
 */
const generateWithProviders = async (prompt, options = {}) => {
  const attempts = [];
  const run = async (providerLabel, fn) => {
    const r = await timed(fn);
    attempts.push(
      r.ok
        ? { ...r.value, latencyMs: r.latencyMs, success: true }
        : { provider: providerLabel, model: null, latencyMs: r.latencyMs, success: false, error: r.error.message }
    );
    return r;
  };

  if (options.useCheckingKey) {
    const r = await run("gemini", async () => callGemini(await getCheckingModel(), prompt, options));
    if (r.ok) return { text: r.value.text, attempts };
    throw Object.assign(r.error, { attempts });
  }

  const primary = getRandomCreationProvider();
  const first = await run(primary.type, () => callProvider(primary, prompt, options));
  if (first.ok) return { text: first.value.text, attempts };
  console.warn(`[AI] Primary provider (${primary.type}) failed: ${first.error.message}`);

  const secondary = options.images?.length ? primary : getRandomCreationProvider();
  const second = await run(secondary.type, () => callProvider(secondary, prompt, options));
  if (second.ok) return { text: second.value.text, attempts };
  throw Object.assign(second.error, { attempts });
};

/** Replaceable in tests. May return a string or { text, attempts }. */
export const aiAdapter = { generate: generateWithProviders };

const writeUsageLog = async (context, prompt, attempt, outputText) => {
  try {
    const hasRealUsage = attempt.inputTokens !== null && attempt.inputTokens !== undefined;
    await db.query(
      `INSERT INTO llm_usage_log
         (assessment_id, user_id, purpose, provider, model, input_tokens, output_tokens,
          tokens_estimated, latency_ms, success, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        context.assessmentId ?? null,
        context.userId ?? null,
        context.purpose,
        attempt.provider || "unknown",
        attempt.model || null,
        hasRealUsage ? attempt.inputTokens : estimateTokens(prompt),
        hasRealUsage ? attempt.outputTokens : attempt.success ? estimateTokens(outputText) : 0,
        !hasRealUsage,
        Math.max(0, Math.round(attempt.latencyMs || 0)),
        Boolean(attempt.success),
        attempt.error ? String(attempt.error).slice(0, 500) : null,
      ]
    );
  } catch (error) {
    // Logging must never break the feature that called the LLM.
    console.error(`[AI] usage log write failed: ${error.message}`);
  }
};

/**
 * Call the LLM.
 * @param {string} prompt
 * @param {object} options
 *   purpose (required for reporting), assessmentId, userId,
 *   maxOutputTokens, temperature, topP, responseMimeType,
 *   images: [{ mimeType, data(base64) }], useCheckingKey
 * @returns {Promise<string>} the model's text
 */
export const generateContent = async (prompt, options = {}) => {
  const context = {
    purpose: options.purpose || "unspecified",
    assessmentId: options.assessmentId,
    userId: options.userId,
  };
  const started = Date.now();
  try {
    const result = await aiAdapter.generate(prompt, options);
    const text = typeof result === "string" ? result : result.text;
    const attempts =
      typeof result === "string" || !result.attempts?.length
        ? [{ provider: "adapter", success: true, latencyMs: Date.now() - started }]
        : result.attempts;
    for (const attempt of attempts) {
      await writeUsageLog(context, prompt, attempt, attempt.success ? text : "");
    }
    return text;
  } catch (error) {
    const attempts = error.attempts?.length
      ? error.attempts
      : [{ provider: "adapter", success: false, latencyMs: Date.now() - started, error: error.message }];
    for (const attempt of attempts) await writeUsageLog(context, prompt, attempt, "");
    throw error;
  }
};
