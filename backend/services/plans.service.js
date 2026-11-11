import db from "../DB/db.js";
import { AppError } from "../utils/AppError.js";
import { PLANS, PLAN_IDS, DEFAULT_PLAN } from "../config/plans.js";

/**
 * Plans and usage. Usage is metered from the database (assessments, enrollments,
 * stored files) and from AI-written questions (question pool and live quick sets),
 * per calendar month (Asia/Karachi) where the limit is monthly.
 *
 * Limits stop NEW work only: creating, enrolling, publishing, uploading, starting a
 * live session. An exam that is already running is never stopped (its on-demand
 * questions ignore the AI budget).
 */
const RANK = { free: 0, pro: 1, institution: 2 };
const MONTH_START = `date_trunc('month', NOW() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi'`;

/** The plan that applies to a user: their own, or a better one from any of their groups. */
export const effectivePlan = async (userId, client = db) => {
  const { rows } = await client.query(
    `SELECT u.plan AS own, (SELECT array_agg(g.plan) FROM group_memberships m JOIN groups g ON g.id = m.group_id WHERE m.user_id = u.id AND g.plan IS NOT NULL) AS from_groups
     FROM users u WHERE u.id = $1`,
    [userId]
  );
  const candidates = [rows[0]?.own || DEFAULT_PLAN, ...(rows[0]?.from_groups || [])].filter((p) => PLANS[p]);
  const best = candidates.sort((a, b) => RANK[b] - RANK[a])[0] || DEFAULT_PLAN;
  return PLANS[best];
};

/** Current usage of an instructor account. */
export const usageOf = async (userId, client = db) => {
  const q = async (sql) => Number((await client.query(sql, [userId])).rows[0].n) || 0;
  return {
    assessmentsPerMonth: await q(`SELECT count(*) AS n FROM assessments WHERE instructor_id = $1 AND created_at >= ${MONTH_START}`),
    students: await q(`SELECT count(DISTINCT e.student_id) AS n FROM enrollments e JOIN assessments a ON a.id = e.assessment_id WHERE a.instructor_id = $1`),
    aiQuestionsPerMonth:
      (await q(
        `SELECT count(*) AS n FROM question_pool p JOIN assessments a ON a.id = p.assessment_id
         WHERE a.instructor_id = $1 AND p.origin = 'ai' AND p.created_at >= ${MONTH_START}`
      )) +
      (await q(
        `SELECT count(*) AS n FROM live_questions q JOIN live_sessions s ON s.id = q.session_id
         WHERE s.instructor_id = $1 AND s.source = 'ai' AND s.created_at >= ${MONTH_START}`
      )),
    storageMb: Math.round((await q(`SELECT COALESCE(sum(file_size), 0) AS n FROM resources WHERE uploaded_by = $1 AND storage_key IS NOT NULL`)) / (1024 * 1024)),
  };
};

/** Plan, limits and usage for the account page / dashboard. */
export const accountUsage = async (userId) => {
  const plan = await effectivePlan(userId);
  return { plan: plan.id, pricePkr: plan.pricePkr, limits: plan.limits, usage: await usageOf(userId) };
};

/**
 * Throw PLAN_LIMIT_REACHED (403) if adding `adding` to `metric` would pass the limit.
 * Admins and the Super Admin are not metered.
 */
export const assertWithinPlan = async (user, metric, adding = 1, client = db) => {
  if (!user || ["admin", "super_admin"].includes(user.role)) return;
  const plan = await effectivePlan(user.id, client);
  const limit = plan.limits[metric];
  if (limit === null || limit === undefined) return;
  const used = (await usageOf(user.id, client))[metric];
  if (used + adding > limit) {
    const error = new AppError("PLAN_LIMIT_REACHED", 403, `Your ${plan.id} plan allows ${limit} (${metric}); you have used ${used}. Ask your administrator to upgrade the plan.`);
    error.details = { metric, limit, used, plan: plan.id };
    throw error;
  }
};

/** Live sessions: size limit of the instructor's plan. */
export const liveSessionLimit = async (user) => (["admin", "super_admin"].includes(user.role) ? null : (await effectivePlan(user.id)).limits.liveSessionSize);

// ------------------------------------------------------------- super admin

export const setUserPlanService = async (userId, plan) => {
  if (!PLAN_IDS.includes(plan)) throw new AppError("INVALID_PLAN", 400, "Unknown plan.");
  const { rows } = await db.query(`UPDATE users SET plan = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id, plan`, [userId, plan]);
  if (!rows[0]) throw new AppError("USER_NOT_FOUND", 404, "User not found.");
  return rows[0];
};

export const setGroupPlanService = async (groupId, plan) => {
  if (plan !== null && !PLAN_IDS.includes(plan)) throw new AppError("INVALID_PLAN", 400, "Unknown plan.");
  const { rows } = await db.query(`UPDATE groups SET plan = $2, updated_at = NOW() WHERE id = $1 RETURNING id, plan`, [groupId, plan]);
  if (!rows[0]) throw new AppError("GROUP_NOT_FOUND", 404, "Group not found.");
  return rows[0];
};

/** Every instructor with their plan and usage (Super Admin). */
export const accountsOverviewService = async () => {
  const { rows } = await db.query(`SELECT id, name, email, plan FROM users WHERE role = 'instructor' AND deleted_at IS NULL ORDER BY name LIMIT 500`);
  const out = [];
  for (const u of rows) {
    const plan = await effectivePlan(u.id);
    out.push({ id: u.id, name: u.name, email: u.email, ownPlan: u.plan, plan: plan.id, limits: plan.limits, usage: await usageOf(u.id) });
  }
  return out;
};

export const groupsPlansService = async () => (await db.query(`SELECT id, name, plan FROM groups ORDER BY name`)).rows;
