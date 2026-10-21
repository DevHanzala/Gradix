import { z } from "zod";
import { translateIssue } from "../utils/forms.js";

// Messages are i18n keys ("key|value" carries one number); translated on display.

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

/** Question types offered in the form; labels are i18n keys. */
export const QUESTION_TYPES = [
  { value: "multiple_choice", labelKey: "questionTypes.multiple_choice" },
  { value: "true_false", labelKey: "questionTypes.true_false" },
  { value: "short_answer", labelKey: "questionTypes.short_answer" },
];

export const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.webp";

const L = ASSESSMENT_LIMITS;

export const questionBlockSchema = z
  .object({
    question_type: z.enum(["multiple_choice", "true_false", "short_answer"]),
    question_count: z.number().int("validation.wholeNumber").min(1, "validation.atLeast|1").max(L.maxQuestionsPerBlock, `validation.atMost|${L.maxQuestionsPerBlock}`),
    duration_per_question: z
      .number()
      .int("validation.wholeNumber")
      .min(L.minDuration, `validation.atLeastSeconds|${L.minDuration}`)
      .max(L.maxDuration, `validation.atMostSeconds|${L.maxDuration}`),
    num_options: z.number().int().nullable().optional(),
    positive_marks: z.number().min(0, "validation.notNegative").max(L.maxMarks, `validation.atMost|${L.maxMarks}`),
    negative_marks: z.number().min(0, "validation.deductionPositive").max(L.maxMarks, `validation.atMost|${L.maxMarks}`),
  })
  .superRefine((block, ctx) => {
    if (block.question_type === "multiple_choice") {
      const n = block.num_options;
      if (!Number.isInteger(n) || n < L.minOptions || n > L.maxOptions) {
        ctx.addIssue({ code: "custom", path: ["num_options"], message: "validation.optionsRange" });
      }
    }
  });

export const assessmentFormSchema = z
  .object({
    title: z.string().trim().min(3, "validation.titleMin").max(L.titleMax, `validation.atMostChars|${L.titleMax}`),
    prompt: z.string().max(L.promptMax, `validation.atMostChars|${L.promptMax}`),
    links: z.array(z.string()),
    resourceIds: z.array(z.number()),
    fileCount: z.number(),
    blocks: z.array(questionBlockSchema).min(1, "validation.blockRequired").max(L.maxBlocks),
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
      if (!ok) ctx.addIssue({ code: "custom", path: ["links", i], message: "validation.linkInvalid" });
    });
    const hasSource =
      data.prompt.trim() || data.links.some((l) => l.trim()) || data.resourceIds.length > 0 || data.fileCount > 0;
    if (!hasSource) {
      ctx.addIssue({ code: "custom", path: ["prompt"], message: "validation.sourceRequired" });
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
    if (!errors[key]) errors[key] = translateIssue(issue.message);
  }
  return errors;
};
