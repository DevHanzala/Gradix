import { z } from "zod";
import { translateIssue } from "../utils/forms.js";

// File validation constants
export const RESOURCE_CONSTANTS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB in bytes
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
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.webp']
};

// File validation schema
export const fileSchema = z.object({
  name: z.string().min(1, "validation.fileNameRequired"),
  size: z.number()
    .positive("validation.fileEmpty")
    .max(RESOURCE_CONSTANTS.MAX_FILE_SIZE, `validation.fileTooLarge|${RESOURCE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}`),
  type: z.string()
    .refine(
      (type) => RESOURCE_CONSTANTS.ALLOWED_FILE_TYPES.includes(type),
      "validation.fileType"
    )
});

// Multiple files validation
export const filesArraySchema = z.array(fileSchema)
  .min(1, "validation.fileRequired")
  .max(10, "validation.tooManyFiles|10");

// Validation helper functions (zod 4 exposes problems as `issues`)
export const validateFiles = (files) => {
  const fileObjects = Array.from(files).map((file) => ({ name: file.name, size: file.size, type: file.type }));
  const result = filesArraySchema.safeParse(fileObjects);
  if (result.success) return { success: true, data: files };
  const messages = [...new Set(result.error.issues.map((issue) => translateIssue(issue.message)))];
  return { success: false, error: messages.join(" ") };
};
