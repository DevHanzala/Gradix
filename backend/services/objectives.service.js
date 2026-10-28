import db, { withTransaction } from "../DB/db.js";
import { generateContent } from "./ai/generateContent.js";
import { enqueue } from "../jobs/queue.js";
import * as objectiveRepo from "../repositories/objectiveRepository.js";
import { findQuestionBlocksByAssessmentQuery } from "../repositories/assessmentRepository.js";
import { searchAssessmentChunks, selectDiverse, countAssessmentChunks } from "./rag/retrieval.js";
import { buildBlueprint } from "./blueprint.js";
import { requireAssessmentAccess } from "./assessmentAccess.js";
import { AppError } from "../utils/AppError.js";
import { normalizeText } from "../utils/grading.js";

/**
 * Learning objectives: extraction (background job), instructor editing and
 * the exam blueprint derived from them.
 *
 * Lifecycle (assessments.status):
 *   draft -> objectives_ready -> publishing -> published
 * objectives_state tracks the extraction job: idle | extracting | ready | failed.
 */
export const OBJECTIVE_LIMITS = { min: 3, max: 15, textMax: 300, descriptionMax: 1000, weightMin: 0.5, weightMax: 10 };
const CANDIDATE_CHUNKS = 40;
const CONTEXT_CHUNKS = 12;
export const EDITABLE_STATUSES = ["draft", "objectives_ready"];
export const EXTRACTION_STALLED_MS = 3 * 60 * 1000;

// ------------------------------------------------------------ blueprint

export const recomputeBlueprint = async (assessmentId, client = db) => {
  const objectives = await objectiveRepo.findObjectivesQuery(assessmentId, client);
  const blocks = await findQuestionBlocksByAssessmentQuery(assessmentId, client);
  const { rows } = await client.query(`SELECT adaptive FROM assessments WHERE id = $1`, [assessmentId]);
  const blueprint = objectives.length ? buildBlueprint(objectives, blocks, { adaptive: Boolean(rows[0]?.adaptive) }) : null;
  await objectiveRepo.saveBlueprintQuery(assessmentId, blueprint, client);
  return blueprint;
};

// ------------------------------------------------------------ extraction

/** Mark the assessment as extracting and enqueue the job (de-duplicated per assessment). */
export const requestObjectiveExtraction = async (assessmentId) => {
  await objectiveRepo.setObjectivesStateQuery(assessmentId, { state: "extracting", status: "draft" });
  try {
    await enqueue("objectives.extract", { assessmentId }, { singletonKey: `assessment-${assessmentId}` });
  } catch (error) {
    // The assessment itself is saved; the instructor can retry or add objectives by hand.
    console.error(`[objectives] could not queue extraction for ${assessmentId}: ${error.message}`);
    await objectiveRepo.setObjectivesStateQuery(assessmentId, {
      state: "failed",
      error: "Objective extraction could not be started. Try again in a moment, or add objectives manually.",
    });
  }
};

const buildExtractionPrompt = (assessment, chunks, { min, max }) => {
  const material = chunks.length
    ? chunks.map((c) => `[chunk ${c.id}] (${c.resource_name})\n${c.chunk_text}`).join("\n\n")
    : "(no uploaded material)";
  return `You are an experienced teacher designing an assessment.
Assessment title: "${assessment.title}"
Instructor's description: "${assessment.prompt || "none"}"

SOURCE MATERIAL (representative passages)
${material}

TASK
List between ${min} and ${max} distinct learning objectives this material teaches and an exam should test${max < OBJECTIVE_LIMITS.max ? ` (the exam has only ${max} questions, so choose the ${max} most important objectives)` : ""}.
Each objective is one short sentence starting with a verb (e.g. "Explain ...", "Identify ...").
Write the objectives in the main language of the source material (English if mixed or none).
Give each a weight from 1 (minor) to 5 (central) reflecting how much of the material covers it.
Cite the chunk ids each objective comes from.

OUTPUT
Return ONLY a JSON array:
[{"text": "...", "description": "one sentence on what exactly is assessed", "source_chunk_ids": [ids], "weight": 1-5}]`;
};

/**
 * How many objectives to extract: 3 to 15, but never more than the questions one
 * student answers, so every objective is actually tested (fewer than 3 only for
 * a 1- or 2-question assessment).
 */
export const objectiveRange = (blocks) => {
  const questions = (blocks || []).reduce((sum, b) => sum + (Number(b.question_count) || 0), 0);
  const max = questions > 0 ? Math.min(OBJECTIVE_LIMITS.max, questions) : OBJECTIVE_LIMITS.max;
  return { min: Math.min(OBJECTIVE_LIMITS.min, max), max };
};

const parseObjectives = (text, allowedChunkIds, { min = OBJECTIVE_LIMITS.min, max = OBJECTIVE_LIMITS.max } = {}) => {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end <= start) throw new Error("No JSON array in objectives response");
  const raw = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(raw)) throw new Error("Objectives response is not an array");

  const seen = new Set();
  const objectives = [];
  for (const item of raw) {
    const text = typeof item?.text === "string" ? item.text.trim().slice(0, OBJECTIVE_LIMITS.textMax) : "";
    if (text.length < 3) continue;
    const key = normalizeText(text);
    if (seen.has(key)) continue;
    seen.add(key);
    const weight = Math.min(5, Math.max(1, Math.round(Number(item.weight) || 1)));
    objectives.push({
      text,
      description: typeof item.description === "string" ? item.description.trim().slice(0, OBJECTIVE_LIMITS.descriptionMax) : null,
      source_chunk_ids: (Array.isArray(item.source_chunk_ids) ? item.source_chunk_ids : [])
        .map(Number)
        .filter((id) => allowedChunkIds.has(id)),
      weight,
    });
  }
  if (objectives.length < min) {
    throw new Error(`Only ${objectives.length} usable objectives were produced`);
  }
  if (objectives.length <= max) return objectives;
  // More than the exam can test: keep the most important ones, in their original order.
  const keep = new Set(
    objectives
      .map((o, i) => ({ i, weight: o.weight }))
      .sort((a, b) => b.weight - a.weight || a.i - b.i)
      .slice(0, max)
      .map((o) => o.i)
  );
  return objectives.filter((_, i) => keep.has(i));
};

/** Representative passages: everything for short material, otherwise relevant AND diverse ones. */
const selectExtractionChunks = async (assessment) => {
  const total = await countAssessmentChunks(assessment.id);
  if (total === 0) return [];
  const query = [assessment.title, assessment.prompt].filter(Boolean).join(". ");
  const candidates = await searchAssessmentChunks(assessment.id, query, Math.max(CANDIDATE_CHUNKS, CONTEXT_CHUNKS));
  const chosen = total <= CONTEXT_CHUNKS ? candidates : selectDiverse(candidates, CONTEXT_CHUNKS);
  // Present passages in document order so the model sees the material's structure.
  return chosen.sort((a, b) => a.resource_id - b.resource_id || a.id - b.id);
};

/**
 * Job handler: extract objectives for an assessment. Idempotent: replaces AI
 * objectives each run; does nothing once the assessment is being published.
 */
export const extractObjectivesJob = async ({ assessmentId }, { attempt = 1, maxAttempts = 1 } = {}) => {
  const assessment = await objectiveRepo.findAssessmentLifecycleQuery(assessmentId);
  if (!assessment || !EDITABLE_STATUSES.includes(assessment.status)) return { skipped: true };

  try {
    const chunks = await selectExtractionChunks(assessment);
    const range = objectiveRange(await findQuestionBlocksByAssessmentQuery(assessmentId));
    const text = await generateContent(buildExtractionPrompt(assessment, chunks, range), {
      purpose: "objective_extraction",
      assessmentId,
      userId: assessment.instructor_id,
      maxOutputTokens: 3000,
      temperature: 0.3,
      responseMimeType: "application/json",
    });
    const objectives = parseObjectives(text, new Set(chunks.map((c) => c.id)), range);

    await withTransaction(async (client) => {
      const locked = await objectiveRepo.findAssessmentLifecycleQuery(assessmentId, client, { forUpdate: true });
      if (!locked || !EDITABLE_STATUSES.includes(locked.status)) return;
      await objectiveRepo.deleteAllObjectivesQuery(assessmentId, client);
      for (const [i, o] of objectives.entries()) {
        await objectiveRepo.insertObjectiveQuery(assessmentId, { ...o, sort_order: i, origin: "ai" }, client);
      }
      await recomputeBlueprint(assessmentId, client);
      await objectiveRepo.setObjectivesStateQuery(assessmentId, { state: "ready", status: "objectives_ready" }, client);
    });
    return { count: objectives.length };
  } catch (error) {
    if (attempt >= maxAttempts) {
      await objectiveRepo.setObjectivesStateQuery(assessmentId, {
        state: "failed",
        error: "Objectives could not be generated automatically. Add them manually or try again.",
      });
    }
    throw error;
  }
};

// ------------------------------------------------------------ instructor API

const toView = async (assessmentId) => {
  const assessment = await objectiveRepo.findAssessmentLifecycleQuery(assessmentId);
  const objectives = await objectiveRepo.findObjectivesQuery(assessmentId);
  return {
    assessmentId,
    status: assessment.status,
    isExecuted: assessment.is_executed,
    objectivesState: assessment.objectives_state,
    objectivesError: assessment.objectives_error,
    // Extraction normally takes well under a minute; past this the UI offers a retry.
    objectivesStalled:
      assessment.objectives_state === "extracting" &&
      Date.now() - new Date(assessment.updated_at).getTime() > EXTRACTION_STALLED_MS,
    editable: EDITABLE_STATUSES.includes(assessment.status) && !assessment.is_executed,
    objectives,
    blueprint: assessment.blueprint,
  };
};

export const getObjectivesService = async (assessmentId, user) => {
  const assessment = await requireAssessmentAccess(assessmentId, user);
  return toView(assessment.id);
};

const invalid = (message) => new AppError("INVALID_OBJECTIVES", 400, message);

export const normalizeObjectiveInput = (items) => {
  if (!Array.isArray(items) || items.length < 1) throw invalid("Add at least one learning objective.");
  if (items.length > OBJECTIVE_LIMITS.max) throw invalid(`At most ${OBJECTIVE_LIMITS.max} learning objectives are allowed.`);
  const seen = new Set();
  return items.map((item, i) => {
    const label = `Objective ${i + 1}`;
    const text = typeof item?.text === "string" ? item.text.trim() : "";
    if (text.length < 3) throw invalid(`${label}: write at least 3 characters.`);
    if (text.length > OBJECTIVE_LIMITS.textMax) throw invalid(`${label}: at most ${OBJECTIVE_LIMITS.textMax} characters.`);
    const key = normalizeText(text);
    if (seen.has(key)) throw invalid(`${label}: duplicates another objective.`);
    seen.add(key);
    const description = typeof item.description === "string" ? item.description.trim() : "";
    if (description.length > OBJECTIVE_LIMITS.descriptionMax) {
      throw invalid(`${label}: description is at most ${OBJECTIVE_LIMITS.descriptionMax} characters.`);
    }
    const weight = item.weight === undefined || item.weight === null || item.weight === "" ? 1 : Number(item.weight);
    if (!Number.isFinite(weight) || weight < OBJECTIVE_LIMITS.weightMin || weight > OBJECTIVE_LIMITS.weightMax) {
      throw invalid(`${label}: weight must be between ${OBJECTIVE_LIMITS.weightMin} and ${OBJECTIVE_LIMITS.weightMax}.`);
    }
    const id = Number.parseInt(item.id, 10);
    return { id: Number.isInteger(id) ? id : null, text, description: description || null, weight, sort_order: i };
  });
};

const assertEditable = (assessment) => {
  if (assessment.is_executed || !EDITABLE_STATUSES.includes(assessment.status)) {
    throw new AppError(
      "OBJECTIVES_LOCKED",
      409,
      "Objectives can no longer be changed because this assessment is being published or has been published."
    );
  }
};

/**
 * Replace the objective list in one save: edit, add, delete and reorder.
 * Items with an id of an existing objective are updated; others are added.
 */
export const replaceObjectivesService = async (assessmentId, items, user) => {
  const owned = await requireAssessmentAccess(assessmentId, user);
  const normalized = normalizeObjectiveInput(items);

  await withTransaction(async (client) => {
    const assessment = await objectiveRepo.findAssessmentLifecycleQuery(owned.id, client, { forUpdate: true });
    assertEditable(assessment);
    const existing = new Map((await objectiveRepo.findObjectivesQuery(owned.id, client)).map((o) => [o.id, o]));
    const keep = normalized.filter((o) => o.id && existing.has(o.id)).map((o) => o.id);
    await objectiveRepo.deleteObjectivesExceptQuery(owned.id, keep, client);
    for (const o of normalized) {
      if (o.id && existing.has(o.id)) await objectiveRepo.updateObjectiveQuery(o.id, o, client);
      else await objectiveRepo.insertObjectiveQuery(owned.id, { ...o, origin: "manual" }, client);
    }
    await recomputeBlueprint(owned.id, client);
    await objectiveRepo.setObjectivesStateQuery(owned.id, { state: "ready", status: "objectives_ready" }, client);
  });
  return toView(owned.id);
};

export const regenerateObjectivesService = async (assessmentId, user) => {
  const owned = await requireAssessmentAccess(assessmentId, user);
  const assessment = await objectiveRepo.findAssessmentLifecycleQuery(owned.id);
  assertEditable(assessment);
  await requestObjectiveExtraction(owned.id);
  return toView(owned.id);
};
