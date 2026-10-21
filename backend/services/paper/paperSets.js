import { generateAssessmentQuestions } from "../../models/assessmentModel.js";
import { selectPoolQuestion, languageBuckets, isLanguageReady } from "../pool/pool.service.js";
import { incrementServedQuery } from "../../repositories/poolRepository.js";
import { normalizeOptions, decodeStoredValue } from "../../utils/grading.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Question sets for printed papers.
 *  - mode "same": one set, printed for everyone.
 *  - mode "unique": `copies` different sets (Paper A, B, C...), one per student.
 * Published assessments draw from the checked pool (least-served questions
 * first, never the same full set twice); printed questions count as served
 * so online students are less likely to meet them. Phase 1 assessments
 * without objectives are generated on the fly.
 */
export const PAPER_LIMITS = { maxCopies: 40, maxLegacyCopies: 5 };
export const paperCode = (index) =>
  index < 26 ? String.fromCharCode(65 + index) : `${String.fromCharCode(65 + Math.floor(index / 26) - 1)}${String.fromCharCode(65 + (index % 26))}`;

const fromPool = async (assessment, language, copies) => {
  const slots = assessment.blueprint.slots;
  const otherSets = new Set();
  const sets = [];
  for (let c = 0; c < copies; c++) {
    const servedIds = [];
    const questions = [];
    for (const [i, slot] of slots.entries()) {
      const row = await selectPoolQuestion({
        assessment,
        language,
        bucket: { ...slot, difficulty: slot.difficulty || 3 },
        servedIds,
        isLast: i === slots.length - 1,
        otherSets,
      });
      if (!row) throw new AppError("POOL_EXHAUSTED", 503, "Not enough questions for this many different papers. Try fewer copies.");
      servedIds.push(row.id);
      questions.push({
        question_type: row.question_type,
        question_text: row.question_text,
        options: row.options ? normalizeOptions(row.options) : null,
        correct_answer: decodeStoredValue(row.correct_answer),
        positive_marks: slot.positive_marks,
        negative_marks: slot.negative_marks,
        pool_question_id: row.id,
      });
    }
    otherSets.add([...servedIds].sort((a, b) => a - b).join(","));
    for (const id of servedIds) await incrementServedQuery(id);
    sets.push({ code: paperCode(c), questions });
  }
  return sets;
};

export const buildPaperSets = async (assessment, language, { mode = "same", copies = 1 } = {}) => {
  const count = mode === "unique" ? Math.max(1, Math.min(PAPER_LIMITS.maxCopies, Number.parseInt(copies, 10) || 1)) : 1;
  const pooled = Boolean(assessment.blueprint?.slots?.length) && ["publishing", "published"].includes(assessment.status);
  if (pooled && isLanguageReady(await languageBuckets(assessment, language))) {
    return fromPool(assessment, language, count);
  }
  if (count > PAPER_LIMITS.maxLegacyCopies) {
    throw new AppError(
      "TOO_MANY_COPIES",
      400,
      `Without a published question pool at most ${PAPER_LIMITS.maxLegacyCopies} different papers can be generated at once.`
    );
  }
  const sets = [];
  for (let c = 0; c < count; c++) {
    const { questions } = await generateAssessmentQuestions(assessment.id, language, assessment);
    if (!questions?.length) throw new AppError("GENERATION_FAILED", 503, "Could not generate questions for the paper. Please try again.");
    sets.push({ code: paperCode(c), questions });
  }
  return sets;
};
