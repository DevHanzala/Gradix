import db from "../DB/db.js";
import { estimateCost } from "../config/llmPricing.js";

/**
 * Super Admin platform statistics: accounts, assessments, attempts, the
 * question pool, and LLM usage with an estimated cost (config/llmPricing.js).
 */
const DEFAULT_DAYS = 30;

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
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, count(*)::int AS calls
       FROM llm_usage_log WHERE created_at > NOW() - make_interval(days => $1)
       GROUP BY 1 ORDER BY 1`,
      [window]
    ),
  ]);

  const models = llmByModel.map((m) => {
    const cost = estimateCost(m.model, m.input_tokens, m.output_tokens);
    return {
      provider: m.provider,
      model: m.model,
      calls: m.calls,
      succeeded: m.succeeded,
      inputTokens: Number(m.input_tokens),
      outputTokens: Number(m.output_tokens),
      avgLatencyMs: m.avg_latency_ms,
      estimatedCostUsd: cost === null ? null : Math.round(cost * 10000) / 10000,
    };
  });
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
      estimatedCostUsd: Math.round(models.reduce((s, m) => s + (m.estimatedCostUsd || 0), 0) * 10000) / 10000,
      unpricedModels: models.filter((m) => m.estimatedCostUsd === null).map((m) => m.model),
      byModel: models,
      byPurpose: llmByPurpose.map((p) => ({ ...p, input_tokens: Number(p.input_tokens), output_tokens: Number(p.output_tokens) })),
      daily: llmDaily,
    },
  };
};
