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

// Validation helper functions
export const validateFiles = (files) => {
  try {
    const fileObjects = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type
    }));
    
    filesArraySchema.parse(fileObjects);
    return { success: true, data: files };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => err.message).join(', ');
      return { success: false, error: errorMessages };
    }
    return { success: false, error: "File validation failed" };
  }
};

export const validateSingleFile = (file) => {
  try {
    fileSchema.parse({
      name: file.name,
      size: file.size,
      type: file.type
    });
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: "File validation failed" };
  }
};