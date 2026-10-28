import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

export const GEMINI_MODEL = "gemini-2.5-flash";
export const GROQ_MODEL = "openai/gpt-oss-20b";

/**
 * Every configured API key, each with a stable label ("gemini-1", "groq-2"…).
 * Labels are what gets logged and shown; the keys themselves never leave here.
 *
 *   Gemini: GEMINI_CREATION_API_KEY_1, GEMINI_CREATION_API_KEY_2, … (any number)
 *   Groq:   GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3, …
 *
 * Free-plan limits apply per Google project / Groq account, so keys from
 * different accounts add capacity; two keys of one project share one quota.
 */
const numbered = (env, pattern) =>
  Object.entries(env)
    .map(([name, value]) => ({ match: name.match(pattern), value }))
    .filter(({ match, value }) => match && value && String(value).trim())
    .map(({ match, value }) => ({ n: Number(match[1] || 1), value: String(value).trim() }))
    .sort((a, b) => a.n - b.n);

let keys = null;
const clients = new Map();

export const listCreationKeys = (env = process.env) => {
  if (keys && env === process.env) return keys;
  const list = [
    ...numbered(env, /^GEMINI_CREATION_API_KEY_(\d+)$/).map(({ n, value }) => ({
      label: `gemini-${n}`,
      type: "gemini",
      model: GEMINI_MODEL,
      secret: value,
    })),
    ...numbered(env, /^GROQ_API_KEY(?:_(\d+))?$/).map(({ n, value }) => ({
      label: `groq-${n}`,
      type: "groq",
      model: GROQ_MODEL,
      secret: value,
    })),
  ];
  // The same key listed twice is one quota: keep the first label.
  const seen = new Set();
  const labels = new Set();
  const unique = list
    .filter((k) => (seen.has(k.secret) ? false : seen.add(k.secret)))
    .map((k) => {
      let label = k.label;
      for (let i = 2; labels.has(label); i++) label = `${k.label}-${i}`; // GROQ_API_KEY and GROQ_API_KEY_1 both set
      labels.add(label);
      return { ...k, label };
    });
  if (env === process.env) keys = unique;
  return unique;
};

/** API client for a key (created once). */
export const clientFor = (key) => {
  if (!clients.has(key.label)) {
    clients.set(key.label, key.type === "gemini" ? new GoogleGenAI({ apiKey: key.secret }) : new Groq({ apiKey: key.secret }));
  }
  return clients.get(key.label);
};

/** Tests: re-read the keys from the environment and/or install a fake client for a label. */
export const resetProviderKeys = () => {
  keys = null;
  clients.clear();
};
export const setClientForTests = (label, client) => clients.set(label, client);

/** Public description of the keys (no secrets). */
export const describeKeys = () => listCreationKeys().map(({ label, type, model }) => ({ label, provider: type, model }));

/* =========================
   CHECKING MODEL (SINGLE)
========================= */

let checkingClient = null;

export const getCheckingModel = async () => {
  if (!checkingClient) {
    if (!process.env.GEMINI_CHECKING_API_KEY) {
      throw new Error("Missing GEMINI_CHECKING_API_KEY");
    }
    checkingClient = new GoogleGenAI({ apiKey: process.env.GEMINI_CHECKING_API_KEY });
  }
  return checkingClient;
};
