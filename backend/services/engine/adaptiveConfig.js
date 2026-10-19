/**
 * Adaptive difficulty and scoring configuration. Every tunable number of the
 * engine lives here.
 *
 * DIFFICULTY (adaptive assessments)
 * - Every student starts at START_DIFFICULTY (3 = medium).
 * - Each closed question gets a performance value p in [0, 1]:
 *     wrong, unanswered or timed out  -> 0
 *     correct                         -> 1 - SLOW_PENALTY * s
 *   where s = clamp((timeTaken / timeAllowed - FAST_RATIO) / (1 - FAST_RATIO), 0, 1),
 *   i.e. a correct answer within FAST_RATIO of the allowed time scores 1, a
 *   correct answer at the very last second scores 1 - SLOW_PENALTY.
 * - The rolling score is the recency-weighted mean of the last WINDOW
 *   performances since the last level change (RECENCY_WEIGHTS, oldest first).
 * - With at least MIN_ANSWERS_TO_MOVE values in the window:
 *     rolling >= UP_THRESHOLD   -> difficulty + 1 (max MAX_DIFFICULTY)
 *     rolling <= DOWN_THRESHOLD -> difficulty - 1 (min MIN_DIFFICULTY)
 *   and the window restarts, so one level change needs fresh evidence.
 * - Which objective and question type comes next is fixed by the blueprint,
 *   so every student covers the objectives equally; only difficulty adapts.
 *
 * SCORING (all assessments)
 * - Raw score: sum of question scores (+positive if correct, -negative if wrong,
 *   0 if unanswered), floored at 0. Raw % = raw / sum of positive marks.
 * - Adjusted score: the same, but a correct answer earns positive x
 *   DIFFICULTY_WEIGHTS[difficulty] (wrong answers lose the unweighted negative mark).
 * - Adjusted % = adjusted / (sum of positive marks x REFERENCE_WEIGHT), capped at 100.
 *   REFERENCE_WEIGHT is the weight of medium difficulty (1.0), so:
 *     all correct on medium questions          -> 100%
 *     all correct on a fixed 10/20/40/20/10 mix -> 100% (the mix averages 1.0)
 *     all correct on easy questions only        -> 60-80%
 *   The uncapped adjusted score is stored too.
 */
export const ADAPTIVE_CONFIG = Object.freeze({
  START_DIFFICULTY: 3,
  MIN_DIFFICULTY: 1,
  MAX_DIFFICULTY: 5,
  WINDOW: 3,
  RECENCY_WEIGHTS: [1, 1.5, 2],
  MIN_ANSWERS_TO_MOVE: 2,
  UP_THRESHOLD: 0.75,
  DOWN_THRESHOLD: 0.4,
  FAST_RATIO: 0.5,
  SLOW_PENALTY: 0.3,
});

export const DIFFICULTY_WEIGHTS = Object.freeze({ 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.2, 5: 1.4 });
export const REFERENCE_WEIGHT = 1.0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Performance of one closed question, in [0, 1]. */
export const performance = ({ correct, timedOut, timeTaken, timeAllowed }, config = ADAPTIVE_CONFIG) => {
  if (!correct || timedOut) return 0;
  const ratio = timeAllowed > 0 ? timeTaken / timeAllowed : 0;
  const slowness = clamp((ratio - config.FAST_RATIO) / (1 - config.FAST_RATIO), 0, 1);
  return 1 - config.SLOW_PENALTY * slowness;
};

const weightedMean = (values, weights) => {
  const w = weights.slice(weights.length - values.length);
  const total = w.reduce((a, b) => a + b, 0);
  return values.reduce((sum, v, i) => sum + v * w[i], 0) / total;
};

/**
 * Replay a history of closed questions (in order) and return the difficulty
 * for the next question plus the full path. Pure and deterministic.
 * @param {Array<{correct:boolean,timedOut:boolean,timeTaken:number,timeAllowed:number,difficulty:number}>} history
 */
export const replayDifficulty = (history, config = ADAPTIVE_CONFIG) => {
  let level = config.START_DIFFICULTY;
  let window = [];
  const path = [];
  for (const [i, item] of history.entries()) {
    const p = performance(item, config);
    window = [...window, p].slice(-config.WINDOW);
    const rolling = weightedMean(window, config.RECENCY_WEIGHTS);
    const before = level;
    if (window.length >= config.MIN_ANSWERS_TO_MOVE) {
      if (rolling >= config.UP_THRESHOLD && level < config.MAX_DIFFICULTY) level += 1;
      else if (rolling <= config.DOWN_THRESHOLD && level > config.MIN_DIFFICULTY) level -= 1;
    }
    if (level !== before) window = [];
    path.push({
      index: i,
      target: before,
      served: item.difficulty ?? before,
      correct: Boolean(item.correct),
      timedOut: Boolean(item.timedOut),
      performance: Math.round(p * 1000) / 1000,
      rolling: Math.round(rolling * 1000) / 1000,
      next: level,
    });
  }
  return { next: level, path };
};

/** Raw and difficulty-adjusted scores for graded questions. */
export const computeScores = (graded) => {
  let raw = 0;
  let adjusted = 0;
  let maxMarks = 0;
  for (const q of graded) {
    const positive = Number(q.positiveMarks) || 0;
    maxMarks += positive;
    raw += q.score;
    if (q.correct) adjusted += positive * (DIFFICULTY_WEIGHTS[q.difficulty] ?? REFERENCE_WEIGHT);
    else adjusted += Math.min(0, q.score); // wrong answers keep their (unweighted) negative mark
  }
  const round = (n) => Math.round(n * 100) / 100;
  const rawScore = Math.max(0, raw);
  const adjustedScore = Math.max(0, adjusted);
  return {
    rawScore: round(rawScore),
    rawPercentage: maxMarks > 0 ? round((rawScore / maxMarks) * 100) : 0,
    adjustedScore: round(adjustedScore),
    adjustedPercentage: maxMarks > 0 ? round(Math.min(100, (adjustedScore / (maxMarks * REFERENCE_WEIGHT)) * 100)) : 0,
    maxMarks: round(maxMarks),
  };
};
