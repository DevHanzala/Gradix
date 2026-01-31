import { z } from "zod";

// Constants
export const ASSESSMENT_CONSTANTS = {
  MIN_TITLE_LENGTH: 3,
  MAX_TITLE_LENGTH: 200,
  MIN_PROMPT_LENGTH: 10,
  MAX_PROMPT_LENGTH: 5000,
  MIN_QUESTION_COUNT: 1,
  MAX_QUESTION_COUNT: 100,
  MIN_DURATION: 30,
  MAX_DURATION: 3600,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 6,
  MIN_MARKS: 0,
  MAX_MARKS: 100,
  QUESTION_TYPES: ['multiple_choice', 'short_answer', 'true_false'],
  MAX_EXTERNAL_LINKS: 10,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
};

// Question block schema
export const questionBlockSchema = z.object({
  question_type: z.enum(ASSESSMENT_CONSTANTS.QUESTION_TYPES, {
    errorMap: () => ({ message: "Invalid question type" })
  }),
  question_count: z.number()
    .int("Question count must be an integer")
    .min(ASSESSMENT_CONSTANTS.MIN_QUESTION_COUNT, `Minimum ${ASSESSMENT_CONSTANTS.MIN_QUESTION_COUNT} question required`)
    .max(ASSESSMENT_CONSTANTS.MAX_QUESTION_COUNT, `Maximum ${ASSESSMENT_CONSTANTS.MAX_QUESTION_COUNT} questions allowed`),
  duration_per_question: z.number()
    .int("Duration must be an integer")
    .min(ASSESSMENT_CONSTANTS.MIN_DURATION, `Minimum ${ASSESSMENT_CONSTANTS.MIN_DURATION} seconds required`)
    .max(ASSESSMENT_CONSTANTS.MAX_DURATION, `Maximum ${ASSESSMENT_CONSTANTS.MAX_DURATION} seconds allowed`),
  num_options: z.number()
    .int("Number of options must be an integer")
    .min(ASSESSMENT_CONSTANTS.MIN_OPTIONS, `Minimum ${ASSESSMENT_CONSTANTS.MIN_OPTIONS} options required`)
    .max(ASSESSMENT_CONSTANTS.MAX_OPTIONS, `Maximum ${ASSESSMENT_CONSTANTS.MAX_OPTIONS} options allowed`)
    .nullable()
    .optional(),
  positive_marks: z.number()
    .min(ASSESSMENT_CONSTANTS.MIN_MARKS, "Positive marks cannot be negative")
    .max(ASSESSMENT_CONSTANTS.MAX_MARKS, `Maximum ${ASSESSMENT_CONSTANTS.MAX_MARKS} marks allowed`)
    .nullable()
    .optional(),
  negative_marks: z.number()
    .min(ASSESSMENT_CONSTANTS.MIN_MARKS, "Negative marks cannot be negative")
    .max(ASSESSMENT_CONSTANTS.MAX_MARKS, `Maximum ${ASSESSMENT_CONSTANTS.MAX_MARKS} marks allowed`)
    .nullable()
    .optional()
}).refine(
  (data) => {
    if (data.question_type === 'multiple_choice') {
      return data.num_options !== null && data.num_options !== undefined;
    }
    return true;
  },
  {
    message: "Number of options is required for multiple choice questions",
    path: ["num_options"]
  }
);

// URL validation schema
const urlSchema = z.string().url("Invalid URL format").or(z.literal(""));

// Assessment form schema
export const assessmentFormSchema = z.object({
  title: z.string()
    .min(ASSESSMENT_CONSTANTS.MIN_TITLE_LENGTH, `Title must be at least ${ASSESSMENT_CONSTANTS.MIN_TITLE_LENGTH} characters`)
    .max(ASSESSMENT_CONSTANTS.MAX_TITLE_LENGTH, `Title must not exceed ${ASSESSMENT_CONSTANTS.MAX_TITLE_LENGTH} characters`)
    .trim(),
  prompt: z.string()
    .max(ASSESSMENT_CONSTANTS.MAX_PROMPT_LENGTH, `Prompt must not exceed ${ASSESSMENT_CONSTANTS.MAX_PROMPT_LENGTH} characters`)
    .optional()
    .nullable(),
  externalLinks: z.array(urlSchema)
    .max(ASSESSMENT_CONSTANTS.MAX_EXTERNAL_LINKS, `Maximum ${ASSESSMENT_CONSTANTS.MAX_EXTERNAL_LINKS} external links allowed`)
    .optional()
    .default([]),
  questionBlocks: z.array(questionBlockSchema)
    .min(1, "At least one question block is required")
    .max(20, "Maximum 20 question blocks allowed"),
  selectedResources: z.array(z.number().int().positive())
    .optional()
    .default([]),
  newFiles: z.array(z.any())
    .optional()
    .default([])
}).refine(
  (data) => {
    // At least one of: prompt, external links, selected resources, or new files must be provided
    const hasPrompt = data.prompt && data.prompt.trim().length >= ASSESSMENT_CONSTANTS.MIN_PROMPT_LENGTH;
    const hasLinks = data.externalLinks && data.externalLinks.some(link => link.trim().length > 0);
    const hasResources = data.selectedResources && data.selectedResources.length > 0;
    const hasFiles = data.newFiles && data.newFiles.length > 0;
    
    return hasPrompt || hasLinks || hasResources || hasFiles;
  },
  {
    message: "Please provide at least one of: AI Prompt (10+ characters), External Links, Selected Resources, or New Files",
    path: ["prompt"]
  }
);

// File validation schema
export const fileValidationSchema = z.object({
  name: z.string().min(1, "File name is required"),
  size: z.number()
    .positive("File size must be positive")
    .max(ASSESSMENT_CONSTANTS.MAX_FILE_SIZE, `File size must not exceed ${ASSESSMENT_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB`),
  type: z.string()
    .refine(
      (type) => ASSESSMENT_CONSTANTS.ALLOWED_FILE_TYPES.includes(type),
      "Invalid file type. Allowed: PDF, DOC, DOCX, TXT, PPT, PPTX, JPG, PNG, WEBP"
    )
});

// Validation helper functions
export const validateAssessmentForm = (formData) => {
  try {
    assessmentFormSchema.parse(formData);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path ? path + ': ' : ''}${err.message}`;
      }).join('\n');
      return { success: false, error: errorMessages };
    }
    return { success: false, error: "Validation failed" };
  }
};

export const validateQuestionBlock = (block) => {
  try {
    questionBlockSchema.parse(block);
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "Question block validation failed" };
  }
};

export const validateFiles = (files) => {
  try {
    const fileObjects = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type
    }));
    
    fileObjects.forEach(file => fileValidationSchema.parse(file));
    return { success: true, data: files };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "File validation failed" };
  }
};