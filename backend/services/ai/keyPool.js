import db from "../../DB/db.js";
import { listCreationKeys } from "./aiProviders.js";

/**
 * Free-plan quota tracking per API key.
 *
 * Usage comes from llm_usage_log (shared by every process), counted from the
 * provider's daily reset: Gemini resets at midnight Pacific time; Groq is
 * counted per UTC day. Requests per minute are tracked in memory.
 *
 * Limits are the published free-plan values at the time of writing. They change,
 * and they are per Google project / Groq account: check AI Studio or the Groq
 * console and override with LLM_FREE_LIMITS_JSON, e.g.
 *   LLM_FREE_LIMITS_JSON={"gemini-2.5-flash":{"rpd":500},"openai/gpt-oss-20b":{"tpd":500000}}
 * rpm/rpd = requests per minute/day, tpm/tpd = tokens per minute/day (null = no limit).
 */
export const DEFAULT_FREE_LIMITS = {
  "gemini-2.5-flash": { rpm: 10, rpd: 250, tpm: 250000, tpd: null, resetTimeZone: "America/Los_Angeles" },
  "openai/gpt-oss-20b": { rpm: 30, rpd: 1000, tpm: 8000, tpd: 200000, resetTimeZone: "UTC" },
};
const UNKNOWN_MODEL_LIMITS = { rpm: null, rpd: null, tpm: null, tpd: null, resetTimeZone: "UTC" };
const USAGE_CACHE_MS = 15 * 1000;
const MINUTE_MS = 60 * 1000;

export const freeLimits = (model) => {
  let overrides = {};
  try {
    overrides = process.env.LLM_FREE_LIMITS_JSON ? JSON.parse(process.env.LLM_FREE_LIMITS_JSON) : {};
  } catch {
    console.error("[AI] LLM_FREE_LIMITS_JSON is not valid JSON; using the defaults");
  }
  return { ...UNKNOWN_MODEL_LIMITS, ...(DEFAULT_FREE_LIMITS[model] || {}), ...(overrides[model] || {}) };
};

// ------------------------------------------------------------ in-memory state

/** label -> { until: ms, reason: "daily" | "minute" } after a rate-limit answer. */
const blocked = new Map();
/** label -> timestamps of requests in the last minute. */
const recent = new Map();
let usageCache = { at: 0, rows: new Map(), resets: new Map() };

export const resetKeyPoolState = () => {
  blocked.clear();
  recent.clear();
  usageCache = { at: 0, rows: new Map(), resets: new Map() };
};

/** Rate-limit errors: 429 / RESOURCE_EXHAUSTED / "rate limit". Daily ones block until the reset. */
export const classifyRateLimit = (error) => {
  const text = `${error?.status ?? ""} ${error?.code ?? ""} ${error?.message ?? ""}`;
  if (!/429|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(text)) return null;
  return /per.?day|PerDay|\bRPD\b|\bTPD\b|daily/i.test(text) ? "daily" : "minute";
};

// ------------------------------------------------------------ usage from the log

/**
 * Today's usage per key label, counted from each provider's reset time.
 * Calls refused with a rate limit are not counted against the quota.
 */
export const usageToday = async ({ fresh = false } = {}) => {
  if (!fresh && Date.now() - usageCache.at < USAGE_CACHE_MS) return usageCache;
  const zones = [...new Set(listCreationKeys().map((k) => freeLimits(k.model).resetTimeZone))];
  const rows = new Map();
  const resets = new Map();
  for (const zone of zones) {
    const { rows: found } = await db.query(
      `SELECT key_label,
              count(*) FILTER (WHERE success OR error IS NULL OR error !~* '429|RESOURCE_EXHAUSTED|rate.?limit|quota')::int AS requests,
              count(*) FILTER (WHERE NOT success)::int AS failed,
              COALESCE(sum(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)::bigint AS tokens
       FROM llm_usage_log
       WHERE key_label IS NOT NULL
         AND created_at >= (date_trunc('day', NOW() AT TIME ZONE $1) AT TIME ZONE $1)
       GROUP BY key_label`,
      [zone]
    );
    const next = (await db.query(`SELECT ((date_trunc('day', NOW() AT TIME ZONE $1) + interval '1 day') AT TIME ZONE $1) AS t`, [zone])).rows[0].t;
    resets.set(zone, new Date(next));
    for (const r of found) rows.set(`${zone}|${r.key_label}`, { requests: r.requests, failed: r.failed, tokens: Number(r.tokens) });
  }
  usageCache = { at: Date.now(), rows, resets };
  return usageCache;
};

const minuteCount = (label) => {
  const now = Date.now();
  const list = (recent.get(label) || []).filter((t) => now - t < MINUTE_MS);
  recent.set(label, list);
  return list.length;
};

/** Status of every key: today's usage, limits, what is left, and whether it can be used now. */
export const keyStatus = async ({ fresh = false } = {}) => {
  const usage = await usageToday({ fresh });
  const now = Date.now();
  return listCreationKeys().map((key) => {
    const limits = freeLimits(key.model);
    const used = usage.rows.get(`${limits.resetTimeZone}|${key.label}`) || { requests: 0, failed: 0, tokens: 0 };
    const block = blocked.get(key.label);
    const blockedUntil = block && block.until > now ? block : null;
    const left = {
      requests: limits.rpd === null ? null : Math.max(0, limits.rpd - used.requests),
      tokens: limits.tpd === null ? null : Math.max(0, limits.tpd - used.tokens),
    };
    const exhausted = left.requests === 0 || left.tokens === 0 || blockedUntil?.reason === "daily";
    const shares = [
      limits.rpd ? used.requests / limits.rpd : 0,
      limits.tpd ? used.tokens / limits.tpd : 0,
    ];
    const status = exhausted ? "exhausted" : blockedUntil ? "cooling" : Math.max(...shares) >= 0.9 ? "low" : "ok";
    return {
      label: key.label,
      provider: key.type,
      model: key.model,
      limits: { rpm: limits.rpm, rpd: limits.rpd, tpm: limits.tpm, tpd: limits.tpd },
      today: used,
      left,
      status,
      resetsAt: usage.resets.get(limits.resetTimeZone)?.toISOString() || null,
      blockedUntil: blockedUntil ? new Date(blockedUntil.until).toISOString() : null,
      requestsLastMinute: minuteCount(key.label),
    };
  });
};

// ------------------------------------------------------------ choosing keys

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Keys to try for one call, best first: keys with quota left today and below
 * their per-minute limit, shuffled so usage spreads over every account. Keys that
 * our counters think are used up come after (the counters are estimates); keys a
 * provider has actually refused for the day are left out until their reset.
 */
export const pickKeys = async ({ needsImages = false } = {}) => {
  const all = listCreationKeys().filter((k) => !needsImages || k.type === "gemini");
  if (!all.length) throw new Error("No AI provider keys are configured");
  let statuses = [];
  try {
    statuses = await keyStatus();
  } catch (error) {
    console.error(`[AI] usage lookup failed, rotating without it: ${error.message}`);
  }
  const byLabel = new Map(statuses.map((s) => [s.label, s]));
  const ready = [];
  const later = [];
  for (const key of all) {
    const s = byLabel.get(key.label);
    if (s?.blockedUntil && s.status === "exhausted") continue;
    const limits = freeLimits(key.model);
    const overMinute = limits.rpm !== null && minuteCount(key.label) >= limits.rpm;
    if (!s || (s.status !== "exhausted" && !s.blockedUntil && !overMinute)) ready.push(key);
    else later.push(key);
  }
  const order = [...shuffle(ready), ...shuffle(later)];
  if (!order.length) {
    const resets = statuses.map((s) => s.resetsAt).filter(Boolean).sort();
    const error = new Error(`Every AI key has reached its free daily limit. Usage resets at ${resets[0] || "the next daily reset"}.`);
    error.code = "AI_QUOTA_EXHAUSTED";
    throw error;
  }
  return order;
};

/** Record a request (for the per-minute window). */
export const noteRequest = (label) => {
  const list = recent.get(label) || [];
  list.push(Date.now());
  recent.set(label, list);
};

/** After a failed call: park the key if the provider said it is rate limited. */
export const noteFailure = async (key, error) => {
  const kind = classifyRateLimit(error);
  if (!kind) return null;
  let until = Date.now() + MINUTE_MS;
  if (kind === "daily") {
    try {
      const usage = await usageToday();
      until = usage.resets.get(freeLimits(key.model).resetTimeZone)?.getTime() || Date.now() + 60 * MINUTE_MS;
    } catch {
      until = Date.now() + 60 * MINUTE_MS;
    }
  }
  blocked.set(key.label, { until, reason: kind });
  usageCache.at = 0; // refresh counts on the next pick
  console.warn(`[AI] ${key.label} rate limited (${kind}); parked until ${new Date(until).toISOString()}`);
  return kind;
};
