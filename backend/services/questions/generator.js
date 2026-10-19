import { generateContent } from "../ai/generateContent.js";
import { mapLanguageCode } from "../ai/aiService.js";
import { searchAssessmentChunks, findAssessmentChunksByIds } from "../rag/retrieval.js";
import { validateQuestion, stemHash } from "./validation.js";

/**
 * Objective-grounded question generation.
 *
 * For one learning objective, retrieve the most relevant passages of the
 * assessment's own material (plus the passages the objective was extracted
 * from) and ask the model for questions of the requested types and
 * difficulties, written natively in the target language. Only those passages
 * are put in the prompt. Invalid questions are dropped and the missing ones
 * requested again (bounded rounds).
 */
export const RETRIEVAL_TOP_K = 4;
export const MAX_CONTEXT_CHUNKS = 6;
const MAX_ROUNDS = 3;

export const DIFFICULTY_RUBRIC = {
  1: "recall a fact stated directly in the passages",
  2: "explain or restate an idea from the passages in other words",
  3: "apply an idea from the passages to a simple new case",
  4: "analyse: compare, contrast or infer across several statements",
  5: "evaluate or synthesise: multi-step reasoning combining several ideas",
};

const TYPE_FORMAT = {
  multiple_choice: (n) =>
    `"options": exactly ${n} plain option texts without letter labels, all plausible and distinct; ` +
    `"correct_answer": the exact text of the ONE correct option`,
  true_false: () => `"options": null; "correct_answer": true or false (JSON boolean)`,
  short_answer: () =>
    `"options": null; "correct_answer": {"answer": "model answer (one or two sentences)", ` +
    `"required_keywords": ["2-4 essential keywords as they would appear in a correct answer"], "min_required_match": 1}`,
};

/** Passages for an objective: top-k by similarity, plus its source passages. */
export const objectiveContext = async (assessmentId, objective) => {
  const query = [objective.text, objective.description].filter(Boolean).join(". ");
  let retrieved = [];
  try {
    retrieved = await searchAssessmentChunks(assessmentId, query, RETRIEVAL_TOP_K);
  } catch (error) {
    console.error(`[generator] retrieval failed for objective ${objective.id}: ${error.message}`);
  }
  const sources = await findAssessmentChunksByIds(assessmentId, objective.source_chunk_ids);
  const byId = new Map();
  for (const chunk of [...sources, ...retrieved]) {
    if (!byId.has(chunk.id)) byId.set(chunk.id, chunk);
  }
  return [...byId.values()].slice(0, MAX_CONTEXT_CHUNKS);
};

const buildPrompt = ({ assessment, objective, language, requests, chunks, avoid }) => {
  const langName = mapLanguageCode(language);
  const passages = chunks.length
    ? chunks.map((c) => `[chunk ${c.id}] (${c.resource_name})\n${c.chunk_text}`).join("\n\n")
    : `No source document. Use only the instructor's topic description: "${assessment.prompt || assessment.title}"`;
  const wanted = requests
    .map(
      (r) =>
        `- ${r.count} x ${r.question_type}, difficulty ${r.difficulty} (${DIFFICULTY_RUBRIC[r.difficulty]}): ` +
        TYPE_FORMAT[r.question_type](r.num_options || 4)
    )
    .join("\n");
  const avoidText = avoid.length
    ? `\nDo NOT repeat or paraphrase these existing questions:\n${avoid.slice(0, 30).map((s) => `- ${s}`).join("\n")}\n`
    : "";

  return `You write fair exam questions for the assessment "${assessment.title}".
Write every word of every question and option natively in ${langName} (not translated from English).
Proper nouns stay as they are written in the source.

LEARNING OBJECTIVE
${objective.text}${objective.description ? `\n${objective.description}` : ""}

SOURCE PASSAGES (use ONLY these; every question must be answerable from them)
${passages}

QUESTIONS TO WRITE
${wanted}
REQUEST_JSON: ${JSON.stringify(requests.map(({ question_type, difficulty, count, num_options }) => ({ question_type, difficulty, count, num_options })))}
LANGUAGE: ${language}
${avoidText}
RULES
- The correct answer must not appear word-for-word in the question.
- Exactly one option is correct; distractors are plausible but clearly wrong per the passages.
- Each question tests the objective above.

OUTPUT
Return ONLY a JSON array; each element:
{"question_type": "...", "difficulty": 1-5, "question_text": "...", "options": ..., "correct_answer": ..., "source_chunk_ids": [ids of the passages used]}`;
};

const parseArray = (text) => {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end <= start) throw new Error("No JSON array in AI response");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("AI response is not an array");
  return parsed;
};

/**
 * @param {object} p
 * @param {{id:number,title:string,prompt?:string}} p.assessment
 * @param {{id:number,text:string,description?:string,source_chunk_ids?:number[]}} p.objective
 * @param {string} p.language
 * @param {Array<{question_type:string,difficulty:number,count:number,num_options?:number}>} p.requests
 * @param {Set<string>} [p.excludeHashes]  stem hashes that must not be produced again
 * @param {string[]} [p.avoidStems]
 * @param {Array} [p.chunks]  pre-fetched context (otherwise retrieved here)
 * @returns {Promise<{questions: object[], rejected: Record<string, number>}>}
 */
export const generateObjectiveQuestions = async ({
  assessment,
  objective,
  language,
  requests,
  excludeHashes = new Set(),
  avoidStems = [],
  chunks,
  userId,
  purpose = "question_generation",
}) => {
  const context = chunks || (await objectiveContext(assessment.id, objective));
  const allowedChunkIds = new Set(context.map((c) => c.id));
  const seen = new Set(excludeHashes);
  const remaining = requests.map((r) => ({ ...r }));
  const questions = [];
  const rejected = {};
  const avoid = [...avoidStems];

  for (let round = 0; round < MAX_ROUNDS && remaining.some((r) => r.count > 0); round++) {
    const open = remaining.filter((r) => r.count > 0);
    let raw;
    try {
      const text = await generateContent(buildPrompt({ assessment, objective, language, requests: open, chunks: context, avoid }), {
        purpose,
        assessmentId: assessment.id,
        userId,
        maxOutputTokens: 6000,
        temperature: 0.8,
        responseMimeType: "application/json",
      });
      raw = parseArray(text);
    } catch (error) {
      rejected.unparseable = (rejected.unparseable || 0) + 1;
      console.error(`[generator] objective ${objective.id} round ${round + 1}: ${error.message}`);
      continue;
    }

    for (const item of raw) {
      const type = String(item?.question_type || "").trim();
      const difficulty = Number(item?.difficulty);
      // Fill the request this item claims to answer; fall back to the first open one of its type.
      const request =
        remaining.find((r) => r.count > 0 && r.question_type === type && r.difficulty === difficulty) ||
        remaining.find((r) => r.count > 0 && r.question_type === type);
      if (!request) continue;

      const result = validateQuestion(item, { question_type: type, language, num_options: request.num_options });
      if (!result.ok) {
        rejected[result.reason] = (rejected[result.reason] || 0) + 1;
        continue;
      }
      const hash = stemHash(result.question.question_text);
      if (seen.has(hash)) {
        rejected.duplicate = (rejected.duplicate || 0) + 1;
        continue;
      }
      seen.add(hash);
      avoid.push(result.question.question_text);
      request.count -= 1;
      const cited = (Array.isArray(item.source_chunk_ids) ? item.source_chunk_ids : []).map(Number).filter((id) => allowedChunkIds.has(id));
      questions.push({
        ...result.question,
        question_type: type,
        difficulty: request.difficulty,
        language,
        objective_id: objective.id,
        source_chunk_ids: cited.length ? cited : [...allowedChunkIds],
        stem_hash: hash,
      });
    }
  }

  return { questions, rejected };
};
