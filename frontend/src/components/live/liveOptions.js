/** Answer choices to chart for a question (true/false questions have fixed choices). */
export const optionsFor = (q) => (q?.type === "true_false" ? ["true", "false"] : q?.options || []);
