import { getRandomCreationProvider, getCheckingModel } from "./aiProviders.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const GROQ_MODEL = "openai/gpt-oss-20b";

const callGemini = async (client, prompt, options) => {
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
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
  return text;
};

const callGroq = async (client, prompt, options) => {
  const response = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxOutputTokens || 3000,
  });
  const text = response?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty Groq response");
  return text;
};

const callProvider = (provider, prompt, options) =>
  provider.type === "gemini" ? callGemini(provider.client, prompt, options) : callGroq(provider.client, prompt, options);

/**
 * Real implementation. `options.purpose === "checking"` uses the separate
 * checking key (recommendations); everything else uses the creation pool with
 * one fallback attempt on another provider.
 */
const generateWithProviders = async (prompt, options = {}) => {
  if (options.purpose === "checking") {
    const client = await getCheckingModel();
    return callGemini(client, prompt, options);
  }

  const primary = getRandomCreationProvider();
  try {
    return await callProvider(primary, prompt, options);
  } catch (primaryError) {
    console.warn(`[AI] Primary provider (${primary.type}) failed: ${primaryError.message}`);
  }

  const secondary = getRandomCreationProvider();
  return callProvider(secondary, prompt, options);
};

/**
 * Indirection so tests can replace the LLM without network access.
 * All application code calls `generateContent`.
 */
export const aiAdapter = { generate: generateWithProviders };

export const generateContent = (prompt, options = {}) => aiAdapter.generate(prompt, options);
