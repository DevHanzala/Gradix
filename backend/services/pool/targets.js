/**
 * How many pool questions each bucket needs.
 *
 * A bucket is (objective, question type, number of options, difficulty) in
 * one language. `minimum` is what one student can need from it (no student
 * ever sees a question twice), so a language is "ready" once every bucket
 * reaches its minimum. `target` is the full pool, sized so that at least
 * MIN_DISTINCT_SETS students can each get a different full question set.
 */
export const MIN_DISTINCT_SETS = 30;
const MAX_EXTRA_PER_BUCKET = 30;
/** Adaptive exams: every difficulty may be needed for every slot of an objective. */
const ADAPTIVE_EXTRA = { 1: 1, 2: 1, 3: 2, 4: 1, 5: 1 };

const binomial = (n, k) => {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return Math.round(result);
};

export const bucketKey = (b) => `${b.objective_id}|${b.question_type}|${b.num_options ?? ""}|${b.difficulty}`;

/** Number of different full sets a pool allows (non-adaptive). */
export const distinctSets = (buckets) => buckets.reduce((product, b) => product * binomial(b.target, b.minimum), 1);

export const computeTargets = (blueprint) => {
  const slots = blueprint?.slots || [];
  const groups = new Map();
  for (const slot of slots) {
    const base = { objective_id: slot.objective_id, question_type: slot.question_type, num_options: slot.num_options ?? null };
    const difficulties = blueprint.adaptive ? [1, 2, 3, 4, 5] : [slot.difficulty];
    for (const difficulty of difficulties) {
      const bucket = { ...base, difficulty };
      const key = bucketKey(bucket);
      if (!groups.has(key)) groups.set(key, { ...bucket, minimum: 0 });
      groups.get(key).minimum += 1;
    }
  }
  const buckets = [...groups.values()];

  if (blueprint?.adaptive) {
    for (const b of buckets) b.target = b.minimum + ADAPTIVE_EXTRA[b.difficulty];
    return buckets;
  }

  for (const b of buckets) b.target = b.minimum + 2;
  // Grow the smallest buckets until enough different full sets exist.
  while (buckets.length && distinctSets(buckets) < MIN_DISTINCT_SETS) {
    const growable = buckets.filter((b) => b.target < b.minimum + MAX_EXTRA_PER_BUCKET);
    if (!growable.length) break;
    growable.sort((a, b) => a.target - a.minimum - (b.target - b.minimum) || a.target - b.target);
    growable[0].target += 1;
  }
  return buckets;
};
