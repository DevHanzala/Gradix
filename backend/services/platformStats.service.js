import db from "../DB/db.js";
import { keyStatus } from "./ai/keyPool.js";

/**
 * Super Admin platform statistics: accounts, assessments, attempts, the
 * question pool, and AI usage in tokens and requests: per day, and today per
 * API key against its free-plan limits (services/ai/keyPool.js). No cost: the
 * keys are on free plans.
 */
const DEFAULT_DAYS = 30;

/** One row per UTC day of the window (days without calls included as zero). */
const fillDays = (rows, window) => {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const days = [];
  for (let i = Math.min(window, 90) - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    days.push({ day, calls: r?.calls || 0, failed: r?.failed || 0, tokens: Number(r?.tokens || 0) });
  }
  return days;
};

export const getPlatformStatsService = async ({ days } = {}) => {
  const window = Math.min(365, Math.max(1, Number.parseInt(days, 10) || DEFAULT_DAYS));
  const count = async (sql, params = []) => (await db.query(sql, params)).rows;

  const [users, assessments, attempts, pool, groups, llmByModel, llmByPurpose, llmDaily] = await Promise.all([
    count(`SELECT role, count(*)::int AS n FROM users WHERE deleted_at IS NULL GROUP BY role`),
    count(`SELECT status, count(*)::int AS n FROM assessments GROUP BY status`),
    count(
      `SELECT count(*) FILTER (WHERE status = 'completed')::int AS completed,
              count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
              count(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - make_interval(days => $1))::int AS completed_recent
       FROM assessment_attempts WHERE is_physical_paper = FALSE`,
      [window]
    ),
    count(`SELECT count(*) FILTER (WHERE status = 'active')::int AS active, count(DISTINCT assessment_id)::int AS assessments FROM question_pool`),
    count(`SELECT count(*)::int AS n FROM groups`),
    count(
      `SELECT provider, model, count(*)::int AS calls, count(*) FILTER (WHERE success)::int AS succeeded,
              COALESCE(sum(input_tokens), 0)::bigint AS input_tokens, COALESCE(sum(output_tokens), 0)::bigint AS output_tokens,
              round(avg(latency_ms))::int AS avg_latency_ms
       FROM llm_usage_log WHERE created_at > NOW() - make_interval(days => $1)
       GROUP BY provider, model ORDER BY calls DESC`,
      [window]
    ),
    count(
      `SELECT purpose, count(*)::int AS calls, count(*) FILTER (WHERE NOT success)::int AS failed,
              COALESCE(sum(input_tokens), 0)::bigint AS input_tokens, COALESCE(sum(output_tokens), 0)::bigint AS output_tokens
       FROM llm_usage_log WHERE created_at > NOW() - make_interval(days => $1)
       GROUP BY purpose ORDER BY calls DESC`,
      [window]
    ),
    count(
      `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day, count(*)::int AS calls,
              count(*) FILTER (WHERE NOT success)::int AS failed,
              COALESCE(sum(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0)::bigint AS tokens
       FROM llm_usage_log WHERE created_at > NOW() - make_interval(days => $1)
       GROUP BY 1 ORDER BY 1`,
      [window]
    ),
  ]);

  const models = llmByModel.map((m) => ({
    provider: m.provider,
    model: m.model,
    calls: m.calls,
    succeeded: m.succeeded,
    inputTokens: Number(m.input_tokens),
    outputTokens: Number(m.output_tokens),
    avgLatencyMs: m.avg_latency_ms,
  }));
  const keys = await keyStatus({ fresh: true });
  const toMap = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r.n]));
  return {
    windowDays: window,
    users: toMap(users, "role"),
    assessments: toMap(assessments, "status"),
    attempts: attempts[0],
    pool: pool[0],
    groups: groups[0].n,
    llm: {
      calls: models.reduce((s, m) => s + m.calls, 0),
      failed: models.reduce((s, m) => s + (m.calls - m.succeeded), 0),
      inputTokens: models.reduce((s, m) => s + m.inputTokens, 0),
      outputTokens: models.reduce((s, m) => s + m.outputTokens, 0),
      byModel: models,
      byPurpose: llmByPurpose.map((p) => ({ ...p, input_tokens: Number(p.input_tokens), output_tokens: Number(p.output_tokens) })),
      daily: fillDays(llmDaily, window),
      keys,
      today: {
        requests: keys.reduce((s, k) => s + k.today.requests, 0),
        tokens: keys.reduce((s, k) => s + k.today.tokens, 0),
        requestsLeft: keys.some((k) => k.left.requests === null) ? null : keys.reduce((s, k) => s + k.left.requests, 0),
        keysAvailable: keys.filter((k) => k.status === "ok" || k.status === "low").length,
      },
    },
  };
};
