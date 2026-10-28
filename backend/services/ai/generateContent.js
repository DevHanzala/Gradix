import db from "../../DB/db.js";
import { getCheckingModel, clientFor, GEMINI_MODEL, GROQ_MODEL } from "./aiProviders.js";
import { pickKeys, noteRequest, noteFailure } from "./keyPool.js";

/**
 * THE single entry point for every LLM call in Gradix.
 * Every call (each provider attempt) is written to llm_usage_log with
 * purpose, provider, model, tokens, latency and success.
 */

export { GEMINI_MODEL, GROQ_MODEL };
/** At most this many keys are tried for one call. */
export const MAX_KEY_ATTEMPTS = 3;

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

const callKey = (key, prompt, options) =>
  key.type === "gemini" ? callGemini(clientFor(key), prompt, options) : callGroq(clientFor(key), prompt, options);

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
 * Calls use the key pool (keyPool.js): keys with free quota left today are
 * shuffled so usage spreads over every account; on failure the next key is
 * tried (up to MAX_KEY_ATTEMPTS), and a key the provider rate-limits is parked
 * until its limit resets. Each attempt is logged with its key label.
 */
export const generateWithProviders = async (prompt, options = {}) => {
  const attempts = [];
  const run = async (providerLabel, fn, { keyLabel = null, model = null } = {}) => {
    const r = await timed(fn);
    attempts.push(
      r.ok
        ? { ...r.value, keyLabel, latencyMs: r.latencyMs, success: true }
        : { provider: providerLabel, model, keyLabel, latencyMs: r.latencyMs, success: false, error: r.error.message }
    );
    return r;
  };

  if (options.useCheckingKey) {
    const r = await run("gemini", async () => callGemini(await getCheckingModel(), prompt, options), { keyLabel: "gemini-checking", model: GEMINI_MODEL });
    if (r.ok) return { text: r.value.text, attempts };
    throw Object.assign(r.error, { attempts });
  }

  const keys = (await pickKeys({ needsImages: Boolean(options.images?.length) })).slice(0, MAX_KEY_ATTEMPTS);
  let lastError;
  for (const key of keys) {
    noteRequest(key.label);
    const r = await run(key.type, () => callKey(key, prompt, options), { keyLabel: key.label, model: key.model });
    if (r.ok) return { text: r.value.text, attempts };
    lastError = r.error;
    await noteFailure(key, r.error);
    console.warn(`[AI] ${key.label} failed: ${String(r.error.message).slice(0, 200)}`);
  }
  throw Object.assign(lastError, { attempts });
};

/** Replaceable in tests. May return a string or { text, attempts }. */
export const aiAdapter = { generate: generateWithProviders };

const writeUsageLog = async (context, prompt, attempt, outputText) => {
  try {
    const hasRealUsage = attempt.inputTokens !== null && attempt.inputTokens !== undefined;
    await db.query(
      `INSERT INTO llm_usage_log
         (assessment_id, user_id, purpose, provider, model, input_tokens, output_tokens,
          tokens_estimated, latency_ms, success, error, key_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
        attempt.keyLabel || null,
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
