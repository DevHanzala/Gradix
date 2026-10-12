import { z } from "zod";

// Mirrors backend/validator/assessmentInput.js. The server re-validates everything.
export const ASSESSMENT_LIMITS = {
  titleMax: 255,
  promptMax: 10000,
  maxBlocks: 20,
  maxQuestionsPerBlock: 100,
  minDuration: 30,
  maxDuration: 3600,
  minOptions: 2,
  maxOptions: 6,
  maxMarks: 100,
  maxFileBytes: 20 * 1024 * 1024,
};

export const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
];

export const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.webp";

const L = ASSESSMENT_LIMITS;

export const questionBlockSchema = z
  .object({
    question_type: z.enum(["multiple_choice", "true_false", "short_answer"]),
    question_count: z.number().int("Whole number").min(1, "At least 1").max(L.maxQuestionsPerBlock, `At most ${L.maxQuestionsPerBlock}`),
    duration_per_question: z
      .number()
      .int("Whole number")
      .min(L.minDuration, `At least ${L.minDuration} seconds`)
      .max(L.maxDuration, `At most ${L.maxDuration} seconds`),
    num_options: z.number().int().nullable().optional(),
    positive_marks: z.number().min(0, "Cannot be negative").max(L.maxMarks, `At most ${L.maxMarks}`),
    negative_marks: z.number().min(0, "Enter the deduction as a positive number").max(L.maxMarks, `At most ${L.maxMarks}`),
  })
  .superRefine((block, ctx) => {
    if (block.question_type === "multiple_choice") {
      const n = block.num_options;
      if (!Number.isInteger(n) || n < L.minOptions || n > L.maxOptions) {
        ctx.addIssue({ code: "custom", path: ["num_options"], message: `${L.minOptions}-${L.maxOptions} options` });
      }
    }
  });

export const assessmentFormSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(L.titleMax, `At most ${L.titleMax} characters`),
    prompt: z.string().max(L.promptMax, `At most ${L.promptMax} characters`),
    links: z.array(z.string()),
    resourceIds: z.array(z.number()),
    fileCount: z.number(),
    blocks: z.array(questionBlockSchema).min(1, "Add at least one question block").max(L.maxBlocks),
  })
  .superRefine((data, ctx) => {
    data.links.forEach((link, i) => {
      if (!link.trim()) return;
      let ok = false;
      try {
        ok = ["http:", "https:"].includes(new URL(link.trim()).protocol);
      } catch {
        ok = false;
      }
      if (!ok) ctx.addIssue({ code: "custom", path: ["links", i], message: "Enter a full link starting with http:// or https://" });
    });
    const hasSource =
      data.prompt.trim() || data.links.some((l) => l.trim()) || data.resourceIds.length > 0 || data.fileCount > 0;
    if (!hasSource) {
      ctx.addIssue({ code: "custom", path: ["prompt"], message: "Write a prompt, or add a resource, file or link to generate questions from" });
    }
  });

/**
 * Flatten zod issues into a map keyed by dotted path, e.g.
 * { title: "...", "blocks.0.duration_per_question": "...", "links.1": "..." }.
 */
export const issuesToErrors = (issues) => {
  const errors = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
};
