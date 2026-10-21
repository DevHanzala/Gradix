/**
 * Estimated LLM prices in USD per 1 million tokens, used only for the
 * Super Admin cost estimate. Defaults are public list prices at the time of
 * writing and WILL drift: override with LLM_PRICES_JSON, e.g.
 *   LLM_PRICES_JSON={"gemini-2.5-flash":{"input":0.3,"output":2.5}}
 * Unknown models count as cost 0 and are listed as "unpriced".
 */
const DEFAULT_PRICES = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "openai/gpt-oss-20b": { input: 0.1, output: 0.5 },
};

export const llmPrices = () => {
  try {
    return { ...DEFAULT_PRICES, ...(process.env.LLM_PRICES_JSON ? JSON.parse(process.env.LLM_PRICES_JSON) : {}) };
  } catch {
    console.error("[pricing] LLM_PRICES_JSON is not valid JSON; using defaults");
    return DEFAULT_PRICES;
  }
};

export const estimateCost = (model, inputTokens, outputTokens) => {
  const price = llmPrices()[model];
  if (!price) return null;
  return ((Number(inputTokens) || 0) * price.input + (Number(outputTokens) || 0) * price.output) / 1e6;
};
