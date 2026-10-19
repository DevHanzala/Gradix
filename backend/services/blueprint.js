/**
 * Exam blueprint: how many questions each learning objective gets, of which
 * type and (for non-adaptive exams) of which difficulty, and in what order.
 *
 * Every student of an assessment gets the same blueprint, so coverage of the
 * objectives is identical for everyone (fairness); only the concrete
 * questions differ.
 *
 *  - Questions per objective: largest-remainder apportionment of the total by
 *    objective weight (every objective gets at least one question while the
 *    total allows it).
 *  - Question types: the instructor's blocks fix how many of each type exist;
 *    they are spread evenly over the slot sequence.
 *  - Difficulty (non-adaptive): DIFFICULTY_MIX per objective, easiest first.
 *  - Order: objectives are interleaved evenly across the paper.
 */
export const BLUEPRINT_VERSION = 1;
export const DIFFICULTY_MIX = { 1: 0.1, 2: 0.2, 3: 0.4, 4: 0.2, 5: 0.1 };

/** Largest-remainder apportionment of `total` over `weights` (ties: earlier wins). */
export const apportion = (total, weights) => {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / sum) * total);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, i) => ({ i, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    counts[i] += 1;
    left -= 1;
  }
  return counts;
};

/** Apportion by weight, then lift any zero to one (taken from the largest share) while the total allows it. */
const apportionAtLeastOne = (total, weights) => {
  const counts = apportion(total, weights);
  if (total < weights.length) return counts;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) continue;
    const donor = counts.indexOf(Math.max(...counts));
    counts[donor] -= 1;
    counts[i] = 1;
  }
  return counts;
};

/** Spread items with the given counts evenly over one sequence (returns item indexes). */
export const spread = (counts) => {
  const total = counts.reduce((a, b) => a + b, 0);
  const used = counts.map(() => 0);
  const sequence = [];
  for (let position = 1; position <= total; position++) {
    let best = -1;
    let bestLag = -Infinity;
    counts.forEach((count, i) => {
      if (used[i] >= count) return;
      const lag = (count * position) / total - used[i];
      if (lag > bestLag + 1e-9) {
        bestLag = lag;
        best = i;
      }
    });
    used[best] += 1;
    sequence.push(best);
  }
  return sequence;
};

/** Difficulty levels for `count` questions following DIFFICULTY_MIX, ascending. */
export const difficultyLevels = (count) => {
  const levels = [1, 2, 3, 4, 5];
  // Ties prefer levels closer to the middle so tiny objectives get medium questions.
  const weights = levels.map((d) => DIFFICULTY_MIX[d]);
  const exact = weights.map((w) => w * count);
  const counts = exact.map(Math.floor);
  let left = count - counts.reduce((a, b) => a + b, 0);
  const order = levels
    .map((d, i) => ({ i, rest: exact[i] - counts[i], distance: Math.abs(d - 3), d }))
    .sort((a, b) => b.rest - a.rest || a.distance - b.distance || a.d - b.d);
  for (const { i } of order) {
    if (left <= 0) break;
    counts[i] += 1;
    left -= 1;
  }
  return levels.flatMap((d, i) => Array(counts[i]).fill(d));
};

/**
 * @param {Array<{id:number, weight:number}>} objectives  in instructor order
 * @param {Array<{question_type, question_count, duration_per_question, num_options, positive_marks, negative_marks}>} blocks
 * @param {{adaptive?: boolean}} options
 */
export const buildBlueprint = (objectives, blocks, { adaptive = false } = {}) => {
  const total = blocks.reduce((sum, b) => sum + Number(b.question_count || 0), 0);
  if (objectives.length === 0 || total === 0) {
    return { version: BLUEPRINT_VERSION, adaptive, total, objectives: [], slots: [] };
  }

  const perObjective = apportionAtLeastOne(
    total,
    objectives.map((o) => Number(o.weight) || 1)
  );
  const objectiveOrder = spread(perObjective); // which objective each slot covers
  const blockOrder = spread(blocks.map((b) => Number(b.question_count || 0))); // which block (type) each slot uses

  const difficultyQueues = perObjective.map((count) => difficultyLevels(count));
  const slots = objectiveOrder.map((objectiveIndex, slot) => {
    const block = blocks[blockOrder[slot]];
    return {
      slot,
      objective_id: objectives[objectiveIndex].id,
      question_type: block.question_type,
      // Adaptive exams pick difficulty at run time; 3 is the starting level.
      difficulty: adaptive ? null : difficultyQueues[objectiveIndex].shift(),
      num_options: block.question_type === "multiple_choice" ? Number(block.num_options) || 4 : null,
      duration_per_question: Number(block.duration_per_question) || 120,
      positive_marks: Number(block.positive_marks ?? 1),
      negative_marks: Math.abs(Number(block.negative_marks ?? 0)),
    };
  });

  return {
    version: BLUEPRINT_VERSION,
    adaptive,
    total,
    objectives: objectives.map((o, i) => {
      const mine = slots.filter((s) => s.objective_id === o.id);
      const types = {};
      const difficulties = {};
      for (const s of mine) {
        types[s.question_type] = (types[s.question_type] || 0) + 1;
        if (s.difficulty) difficulties[s.difficulty] = (difficulties[s.difficulty] || 0) + 1;
      }
      return { objective_id: o.id, weight: Number(o.weight) || 1, count: perObjective[i], types, difficulties };
    }),
    slots,
  };
};
