import db, { withTransaction } from "../../DB/db.js";
import { enqueue } from "../../jobs/queue.js";
import * as poolRepo from "../../repositories/poolRepository.js";
import * as objectiveRepo from "../../repositories/objectiveRepository.js";
import { embedPassages, toPgVector } from "../../helper/embeddingGenerator.js";
import { generateObjectiveQuestions, objectiveContext } from "../questions/generator.js";
import { computeTargets, bucketKey } from "./targets.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Question pool: pre-generated, validated questions per
 * objective x type x difficulty x language. Students are served from it, so
 * starting an exam does not wait for the LLM and every question was
 * validated before anyone saw it.
 */
export const POOL_LANGUAGES = ["en", "ur", "ar", "fa"];
export const DEFAULT_LANGUAGES = ["en", "ur", "ar"];
/** Two stems at least this similar (cosine, multilingual-e5) count as the same question. */
export const SIMILARITY_THRESHOLD = 0.95;
/** Average times a question may be served before the bucket is topped up. */
export const MAX_EXPOSURE = 5;
const MAX_BUCKET_SIZE = 60;
const MAX_PER_CALL = 10;
export const ON_DEMAND_TIMEOUT_MS = Number(process.env.POOL_ON_DEMAND_TIMEOUT_MS) || 20000;

const cosine = (a, b) => {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // e5 vectors are normalised
};

const loadAssessment = async (assessmentId, client = db) => {
  const { rows } = await client.query(
    `SELECT id, title, prompt, instructor_id, status, blueprint, languages, published_at, is_executed
     FROM assessments WHERE id = $1`,
    [assessmentId]
  );
  return rows[0] || null;
};

// ------------------------------------------------------------- status

/** Buckets with have/minimum/target for one language (target grows with exposure). */
export const languageBuckets = async (assessment, language, client = db) => {
  const targets = computeTargets(assessment.blueprint);
  const counts = new Map(
    (await poolRepo.countActiveByBucketQuery(assessment.id, language, client)).map((r) => [
      bucketKey({ ...r, num_options: r.num_options ?? null }),
      r,
    ])
  );
  return targets.map((b) => {
    const row = counts.get(bucketKey(b));
    const have = row?.n || 0;
    const exposureTarget = Math.ceil((row?.served || 0) / MAX_EXPOSURE);
    const target = Math.min(MAX_BUCKET_SIZE, Math.max(b.target, exposureTarget));
    return { ...b, have, target };
  });
};

export const isLanguageReady = (buckets) => buckets.length > 0 && buckets.every((b) => b.have >= b.minimum);

export const poolStatus = async (assessmentId, client = db) => {
  const assessment = await loadAssessment(assessmentId, client);
  const states = new Map((await poolRepo.findLanguageStatesQuery(assessmentId, client)).map((s) => [s.language, s]));
  const languages = [];
  for (const language of assessment.languages || []) {
    const buckets = assessment.blueprint ? await languageBuckets(assessment, language, client) : [];
    const target = buckets.reduce((s, b) => s + b.target, 0);
    const have = buckets.reduce((s, b) => s + Math.min(b.have, b.target), 0);
    const state = states.get(language);
    languages.push({
      language,
      state: state?.state || "filling",
      error: state?.error || null,
      ready: isLanguageReady(buckets),
      questions: buckets.reduce((s, b) => s + b.have, 0),
      target,
      percent: target ? Math.round((have / target) * 100) : 0,
    });
  }
  return { assessmentId, status: assessment.status, publishedAt: assessment.published_at, languages };
};

// --------------------------------------------------------------- fill

/** Drop questions that duplicate the pool (hash) or are near-duplicates (embedding). */
const filterNovel = async (questions, existing) => {
  if (!questions.length) return [];
  const vectors = await embedPassages(questions.map((q) => q.question_text));
  const known = existing.filter((e) => e.embedding);
  const hashes = new Set(existing.map((e) => e.stem_hash));
  const accepted = [];
  questions.forEach((q, i) => {
    const vector = vectors[i];
    if (hashes.has(q.stem_hash)) return;
    if (known.some((e) => cosine(e.embedding, vector) >= SIMILARITY_THRESHOLD)) return;
    hashes.add(q.stem_hash);
    known.push({ embedding: vector });
    accepted.push({ ...q, embedding: toPgVector(vector) });
  });
  return accepted;
};

/** Generate and store questions for the given bucket deficits of one objective. */
const generateIntoPool = async ({ assessment, objective, language, deficits, existing, userId }) => {
  const context = await objectiveContext(assessment.id, objective);
  let inserted = 0;
  const queue = deficits.map((d) => ({ ...d }));
  const total = queue.reduce((sum, d) => sum + d.count, 0);
  const maxRounds = Math.ceil(total / MAX_PER_CALL) + 2;
  for (let round = 0; round < maxRounds && queue.some((d) => d.count > 0); round++) {
    // At most MAX_PER_CALL questions per LLM call keeps responses reliable.
    const requests = [];
    let room = MAX_PER_CALL;
    for (const d of queue) {
      if (d.count <= 0 || room <= 0) continue;
      const n = Math.min(d.count, room);
      requests.push({ question_type: d.question_type, difficulty: d.difficulty, num_options: d.num_options, count: n });
      room -= n;
    }
    const { questions } = await generateObjectiveQuestions({
      assessment,
      objective,
      language,
      requests,
      chunks: context,
      excludeHashes: new Set(existing.map((e) => e.stem_hash)),
      avoidStems: existing.slice(-30).map((e) => e.question_text),
      userId,
      purpose: "pool_generation",
    });
    const novel = await filterNovel(questions, existing);
    let progressed = 0;
    for (const q of novel) {
      const row = await poolRepo.insertPoolQuestionQuery(assessment.id, q);
      if (!row) continue;
      existing.push({ stem_hash: q.stem_hash, question_text: q.question_text, embedding: JSON.parse(q.embedding) });
      const d = queue.find(
        (x) => x.question_type === q.question_type && x.difficulty === q.difficulty && (x.num_options ?? null) === (q.options ? q.options.length : null) && x.count > 0
      );
      if (d) d.count -= 1;
      inserted += 1;
      progressed += 1;
    }
    // No progress: leave the rest to the job retry (with backoff) instead of spinning.
    if (progressed === 0) break;
  }
  return inserted;
};

/** Mark the assessment published once every selected language is ready. */
const maybePublish = async (assessmentId, client = db) => {
  const assessment = await loadAssessment(assessmentId, client);
  if (assessment.status !== "publishing") return false;
  const states = await poolRepo.findLanguageStatesQuery(assessmentId, client);
  const ready = new Set(states.filter((s) => s.state === "ready").map((s) => s.language));
  if (!(assessment.languages || []).every((l) => ready.has(l))) return false;
  const { rowCount } = await client.query(
    `UPDATE assessments SET status = 'published', published_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'publishing'`,
    [assessmentId]
  );
  return rowCount > 0;
};

/** Hook for side effects of publishing (notifications are attached in section 6). */
export const publishHooks = { onPublished: async () => {} };

/**
 * Job: fill one language's pool up to its targets. Idempotent (only the
 * deficit is generated). Throws while a bucket is below its minimum so
 * pg-boss retries with backoff; the last attempt records a failure.
 */
export const fillPoolJob = async ({ assessmentId, language }, { attempt = 1, maxAttempts = 1 } = {}) => {
  const assessment = await loadAssessment(assessmentId);
  if (!assessment || !["publishing", "published"].includes(assessment.status) || !assessment.blueprint) {
    return { skipped: true };
  }

  const objectives = new Map((await objectiveRepo.findObjectivesQuery(assessmentId)).map((o) => [o.id, o]));
  const existing = await poolRepo.findActiveHashesQuery(assessmentId, language);
  const buckets = await languageBuckets(assessment, language);
  const byObjective = new Map();
  for (const b of buckets) {
    const count = b.target - b.have;
    if (count <= 0) continue;
    if (!byObjective.has(b.objective_id)) byObjective.set(b.objective_id, []);
    byObjective.get(b.objective_id).push({ ...b, count });
  }

  let inserted = 0;
  for (const [objectiveId, deficits] of byObjective) {
    const objective = objectives.get(objectiveId);
    if (!objective) continue;
    try {
      inserted += await generateIntoPool({ assessment, objective, language, deficits, existing, userId: assessment.instructor_id });
    } catch (error) {
      console.error(`[pool] ${assessmentId}/${language} objective ${objectiveId}: ${error.message}`);
    }
  }

  const after = await languageBuckets(assessment, language);
  if (isLanguageReady(after)) {
    await poolRepo.setLanguageStateQuery(assessmentId, language, "ready");
    if (await maybePublish(assessmentId)) await publishHooks.onPublished(assessmentId);
    return { inserted, ready: true };
  }
  if (attempt >= maxAttempts) {
    await poolRepo.setLanguageStateQuery(
      assessmentId,
      language,
      "failed",
      "Not enough valid questions could be generated for this language. Retry publishing, or add questions manually."
    );
    return { inserted, ready: false };
  }
  throw new Error(`Pool for ${assessmentId}/${language} is below its minimum after this run`);
};

export const enqueueFill = (assessmentId, language) =>
  enqueue("pool.fill", { assessmentId, language }, { singletonKey: `pool-${assessmentId}-${language}` });

// ------------------------------------------------------------ publish

export const normalizeLanguages = (languages) => {
  const list = Array.isArray(languages) && languages.length ? languages : DEFAULT_LANGUAGES;
  const unique = [...new Set(list.map(String))];
  if (unique.some((l) => !POOL_LANGUAGES.includes(l))) {
    throw new AppError("UNSUPPORTED_LANGUAGE", 400, "Choose languages from English, Urdu, Arabic and Persian.");
  }
  return unique;
};

/**
 * Start publishing: lock objectives/blueprint and pre-generate the pool for
 * each selected language in the background.
 */
export const publishAssessment = async (assessmentId, languages) => {
  const chosen = normalizeLanguages(languages);
  await withTransaction(async (client) => {
    const assessment = await objectiveRepo.findAssessmentLifecycleQuery(assessmentId, client, { forUpdate: true });
    if (assessment.status !== "objectives_ready" || !assessment.blueprint?.slots?.length) {
      throw new AppError(
        "NOT_READY_TO_PUBLISH",
        409,
        assessment.status === "draft"
          ? "Review the learning objectives before publishing."
          : "This assessment is already being published."
      );
    }
    await client.query(`UPDATE assessments SET status = 'publishing', languages = $2, updated_at = NOW() WHERE id = $1`, [
      assessmentId,
      chosen,
    ]);
    await client.query(`DELETE FROM pool_language_state WHERE assessment_id = $1`, [assessmentId]);
    for (const language of chosen) await poolRepo.setLanguageStateQuery(assessmentId, language, "filling", null, client);
  });
  for (const language of chosen) await enqueueFill(assessmentId, language);
};

/** Retry the languages whose pool failed to fill. */
export const retryPublish = async (assessmentId) => {
  const states = await poolRepo.findLanguageStatesQuery(assessmentId);
  for (const s of states.filter((x) => x.state === "failed")) {
    await poolRepo.setLanguageStateQuery(assessmentId, s.language, "filling");
    await enqueueFill(assessmentId, s.language);
  }
};

// ------------------------------------------------------------- serving

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms).unref?.())]);

/** Generate one question for a bucket right now (bounded by a timeout); stores it in the pool. */
export const generateOnDemand = async (assessment, bucket, language, existingHashes) => {
  const objective = (await objectiveRepo.findObjectivesQuery(assessment.id)).find((o) => o.id === bucket.objective_id);
  if (!objective) return null;
  const work = (async () => {
    const { questions } = await generateObjectiveQuestions({
      assessment,
      objective,
      language,
      requests: [{ question_type: bucket.question_type, difficulty: bucket.difficulty, num_options: bucket.num_options, count: 1 }],
      excludeHashes: existingHashes,
      purpose: "pool_on_demand",
    });
    const [q] = await filterNovel(questions, await poolRepo.findActiveHashesQuery(assessment.id, language));
    if (!q) return null;
    const row = await poolRepo.insertPoolQuestionQuery(assessment.id, q);
    return row ? poolRepo.findPoolQuestionQuery(assessment.id, row.id) : null;
  })().catch((error) => {
    console.error(`[pool] on-demand generation failed: ${error.message}`);
    return null;
  });
  return withTimeout(work, ON_DEMAND_TIMEOUT_MS);
};

const setKey = (ids) => [...ids].sort((a, b) => a - b).join(",");

/** Full question sets (pool ids) other students of this assessment/language received. */
export const otherStudentSets = async (assessmentId, language, attemptId, client = db) => {
  const { rows } = await client.query(
    `SELECT gq.attempt_id, array_agg(gq.pool_question_id) AS ids
     FROM generated_questions gq JOIN assessment_attempts aa ON aa.id = gq.attempt_id
     WHERE aa.assessment_id = $1 AND aa.language = $2 AND aa.id <> $3 AND gq.pool_question_id IS NOT NULL
     GROUP BY gq.attempt_id`,
    [assessmentId, language, attemptId || 0]
  );
  return new Set(rows.map((r) => setKey(r.ids)));
};

/**
 * Pick the question for one slot.
 *   1. least-served unseen question from the exact bucket;
 *   2. on-demand generation for that bucket (timeout);
 *   3. nearest difficulty of the same objective and type.
 * On the last slot, a candidate that would give this student exactly the
 * same full set as another student is skipped.
 * Returns a pool row, or null when nothing can be served.
 */
export const selectPoolQuestion = async ({ assessment, language, bucket, servedIds, isLast, otherSets }, client = db) => {
  const exclude = [...servedIds];
  const acceptable = (row) => !isLast || !otherSets.has(setKey([...servedIds, row.id]));

  const exact = (await poolRepo.findBucketCandidatesQuery(assessment.id, language, bucket, exclude, client)).find(acceptable);
  if (exact) return exact;

  const hashes = new Set((await poolRepo.findActiveHashesQuery(assessment.id, language, client)).map((h) => h.stem_hash));
  const fresh = await generateOnDemand(assessment, bucket, language, hashes);
  if (fresh) return fresh;

  const order = [1, 2, 3, 4]
    .flatMap((delta) => [bucket.difficulty - delta, bucket.difficulty + delta])
    .filter((d) => d >= 1 && d <= 5);
  for (const difficulty of order) {
    const near = (await poolRepo.findBucketCandidatesQuery(assessment.id, language, { ...bucket, difficulty }, exclude, client)).find(
      acceptable
    );
    if (near) return near;
  }
  return null;
};

/** After serving, refill a bucket that is short or over-exposed (background). */
export const topUpIfLow = async (assessment, language) => {
  try {
    const buckets = await languageBuckets(assessment, language);
    if (buckets.some((b) => b.have < b.target)) await enqueueFill(assessment.id, language);
  } catch (error) {
    console.error(`[pool] top-up check failed: ${error.message}`);
  }
};

export { loadAssessment };
