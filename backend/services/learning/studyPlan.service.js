import db from "../../DB/db.js";
import { generateContent } from "../ai/generateContent.js";
import { mapLanguageCode } from "../ai/aiService.js";
import { objectiveContext } from "../questions/generator.js";
import { findObjectivesQuery } from "../../repositories/objectiveRepository.js";
import { translate, normalizeLanguage } from "../../helper/i18n.js";
import { getResultsService } from "./results.service.js";

/**
 * AI study plan for a completed attempt, in the student's language, grounded
 * in the passages of the student's weak objectives. Stored per attempt and
 * language in learning_reports; falls back to a plain plan built from the
 * same data if the model fails (never an error for the student).
 */
const MAX_STEPS = 5;
const PASSAGES_PER_OBJECTIVE = 3;
const EXCERPT_CHARS = 400;

export const findReportQuery = async (attemptId, language, client = db) => {
  const { rows } = await client.query(`SELECT * FROM learning_reports WHERE attempt_id = $1 AND language = $2`, [attemptId, language]);
  return rows[0] || null;
};

export const saveStudyPlanQuery = async ({ attemptId, assessmentId, studentId, language, plan, source }, client = db) => {
  const { rows } = await client.query(
    `INSERT INTO learning_reports (attempt_id, assessment_id, student_id, language, study_plan, study_plan_source)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (attempt_id, language)
     DO UPDATE SET study_plan = EXCLUDED.study_plan, study_plan_source = EXCLUDED.study_plan_source,
                   pdf = NULL, pdf_generated_at = NULL, updated_at = NOW()
     RETURNING *`,
    [attemptId, assessmentId, studentId, language, JSON.stringify(plan), source]
  );
  return rows[0];
};

/** Objectives to plan for: weak areas, or (if none) the two lowest-scoring ones. */
const focusObjectives = (results) =>
  results.weakAreas.length ? results.weakAreas : [...results.objectives].sort((a, b) => a.accuracy - b.accuracy).slice(0, 2);

const buildPrompt = ({ results, focus, passages, language }) => {
  const langName = mapLanguageCode(language);
  const objectivesText = focus
    .map((o) => `- [objective ${o.objectiveId}] ${o.text} (accuracy ${o.accuracy}%: ${o.correct} of ${o.questions} correct)`)
    .join("\n");
  const passagesText = passages.length
    ? passages.map((p) => `[chunk ${p.id}] (objective ${p.objectiveId}, ${p.resource_name})\n${p.chunk_text}`).join("\n\n")
    : "(no source material; base the plan on the objectives only)";
  return `You are a supportive tutor. Write a short, practical study plan for a student, entirely in ${langName}.

ASSESSMENT: "${results.title}"
OVERALL: ${results.scores.rawPercentage}% score, ${results.accuracy.percentage}% of questions correct.

OBJECTIVES TO IMPROVE
${objectivesText}

SOURCE PASSAGES (from the course material; cite chunk ids the student should re-read)
${passagesText}

RULES
- One step per objective above, in the same order, at most ${MAX_STEPS} steps.
- Each step: what to focus on, why (from the results), 2-4 concrete activities, and the chunk ids to re-read.
- Use only the passages above; do not invent facts. Be encouraging and specific.

OUTPUT: ONLY JSON:
{"summary": "...", "steps": [{"objective_id": number, "focus": "...", "why": "...", "activities": ["..."], "source_chunk_ids": [numbers]}], "encouragement": "..."}`;
};

const parsePlan = (text, focus, passages) => {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in study plan");
  const raw = JSON.parse(cleaned.slice(start, end + 1));
  const allowedObjectives = new Set(focus.map((o) => o.objectiveId));
  const str = (v, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .filter((s) => allowedObjectives.has(Number(s?.objective_id)))
    .slice(0, MAX_STEPS)
    .map((s) => {
      const objectiveId = Number(s.objective_id);
      const ownPassages = new Set(passages.filter((p) => p.objectiveId === objectiveId).map((p) => p.id));
      return {
        objectiveId,
        focus: str(s.focus, 300),
        why: str(s.why, 400),
        activities: (Array.isArray(s.activities) ? s.activities : []).map((a) => str(a, 300)).filter(Boolean).slice(0, 4),
        sourceChunkIds: (Array.isArray(s.source_chunk_ids) ? s.source_chunk_ids : []).map(Number).filter((id) => ownPassages.has(id)),
      };
    })
    .filter((s) => s.focus && s.activities.length);
  if (!steps.length) throw new Error("Study plan has no usable steps");
  return { summary: str(raw.summary, 800), steps, encouragement: str(raw.encouragement, 400) };
};

/** Same structure without the model, from the results and the backend catalog. */
const fallbackPlan = (results, focus, passages, language) => ({
  summary: translate(language, "studyPlan.fallbackSummary", { score: results.scores.rawPercentage }),
  steps: focus.map((o) => ({
    objectiveId: o.objectiveId,
    focus: o.text,
    why: translate(language, "studyPlan.fallbackWhy", { correct: o.correct, total: o.questions }),
    activities: [translate(language, "studyPlan.fallbackReread"), translate(language, "studyPlan.fallbackPractice"), translate(language, "studyPlan.fallbackExplain")],
    sourceChunkIds: passages.filter((p) => p.objectiveId === o.objectiveId).map((p) => p.id),
  })),
  encouragement: translate(language, "studyPlan.fallbackEncouragement"),
});

/** Attach passage excerpts for display (resource name + text). */
const withPassages = (plan, passages, focus) => {
  const byId = new Map(passages.map((p) => [p.id, p]));
  const objective = new Map(focus.map((o) => [o.objectiveId, o]));
  return {
    ...plan,
    steps: plan.steps.map((s) => ({
      ...s,
      objectiveText: objective.get(s.objectiveId)?.text,
      objectiveNumber: objective.get(s.objectiveId)?.number,
      accuracy: objective.get(s.objectiveId)?.accuracy,
      passages: s.sourceChunkIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((p) => ({ chunkId: p.id, resourceName: p.resource_name, excerpt: p.chunk_text.slice(0, EXCERPT_CHARS) })),
    })),
  };
};

export const getStudyPlanService = async (student, assessmentId, { language: requested, refresh = false } = {}) => {
  const results = await getResultsService(student.id, assessmentId);
  const language = normalizeLanguage(requested || student.language_preference || results.language);
  const existing = await findReportQuery(results.attemptId, language);
  if (existing?.study_plan && !refresh) {
    return { language, source: existing.study_plan_source, plan: existing.study_plan, createdAt: existing.updated_at };
  }

  const focus = focusObjectives(results);
  if (!focus.length) {
    // Phase 1 assessment without objectives: nothing to ground a plan in.
    const plan = { summary: translate(language, "studyPlan.noObjectives"), steps: [], encouragement: "" };
    return { language, source: "fallback", plan };
  }

  const objectives = new Map((await findObjectivesQuery(results.assessmentId)).map((o) => [o.id, o]));
  const passages = [];
  for (const o of focus) {
    const objective = objectives.get(o.objectiveId);
    if (!objective) continue;
    for (const chunk of (await objectiveContext(results.assessmentId, objective)).slice(0, PASSAGES_PER_OBJECTIVE)) {
      if (!passages.some((p) => p.id === chunk.id)) passages.push({ ...chunk, objectiveId: o.objectiveId });
    }
  }

  let plan;
  let source = "ai";
  try {
    const text = await generateContent(buildPrompt({ results, focus, passages, language }), {
      purpose: "study_plan",
      assessmentId: results.assessmentId,
      userId: student.id,
      maxOutputTokens: 3000,
      temperature: 0.5,
      responseMimeType: "application/json",
    });
    plan = parsePlan(text, focus, passages);
  } catch (error) {
    console.error(`[study-plan] falling back for attempt ${results.attemptId}: ${error.message}`);
    plan = fallbackPlan(results, focus, passages, language);
    source = "fallback";
  }

  const full = withPassages(plan, passages, focus);
  const saved = await saveStudyPlanQuery({
    attemptId: results.attemptId,
    assessmentId: results.assessmentId,
    studentId: student.id,
    language,
    plan: full,
    source,
  });
  return { language, source, plan: full, createdAt: saved.updated_at };
};
