/** Answer choices to chart for a question (true/false has fixed choices); null when answers are not choices. */
export const optionsFor = (q) => (q?.type === "true_false" ? ["true", "false"] : q?.type === "multiple_choice" ? q.options || [] : null);
