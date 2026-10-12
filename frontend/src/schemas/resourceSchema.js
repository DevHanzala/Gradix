import { z } from "zod";

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
  name: z.string().min(1, "File name is required"),
  size: z.number()
    .positive("File size must be positive")
    .max(RESOURCE_CONSTANTS.MAX_FILE_SIZE, `File size must not exceed ${RESOURCE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB`),
  type: z.string()
    .refine(
      (type) => RESOURCE_CONSTANTS.ALLOWED_FILE_TYPES.includes(type),
      "Invalid file type. Please upload PDF, DOC, DOCX, TXT, PPT, PPTX, or image files."
    )
});

// Multiple files validation
export const filesArraySchema = z.array(fileSchema)
  .min(1, "At least one file must be selected")
  .max(10, "Cannot upload more than 10 files at once");

// Validation helper functions (zod 4 exposes problems as `issues`)
export const validateFiles = (files) => {
  const fileObjects = Array.from(files).map((file) => ({ name: file.name, size: file.size, type: file.type }));
  const result = filesArraySchema.safeParse(fileObjects);
  if (result.success) return { success: true, data: files };
  const messages = [...new Set(result.error.issues.map((issue) => issue.message))];
  return { success: false, error: messages.join(" ") };
};
