import { randomUUID } from "crypto";
import { AppError } from "../../utils/AppError.js";
import { storage, publicBaseUrl } from "../../helper/storage.js";

/**
 * Images in questions: one optional image on the question and one per MCQ option.
 * Stored as { key, alt } (alt text is required); the files live in file storage
 * under question-images/<assessmentId>/ and reach browsers only as signed URLs.
 */
export const IMAGE_LIMITS = { maxBytes: 5 * 1024 * 1024, maxSide: 1280, quality: 80, altMax: 250 };
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const KEY_PREFIX = "question-images/";

const invalid = (message) => new AppError("INVALID_IMAGE", 400, message);

/** Resize to at most 1280 px on the longest side and re-encode as WebP (smaller, strips metadata). */
export const compressImage = async (buffer) => {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  let image;
  try {
    image = await loadImage(buffer);
  } catch {
    throw invalid("This file is not a readable image.");
  }
  const scale = Math.min(1, IMAGE_LIMITS.maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  return { data: await canvas.encode("webp", IMAGE_LIMITS.quality), width, height };
};

/** Store an uploaded image for an assessment's questions; returns { key, width, height, bytes }. */
export const storeQuestionImage = async (assessmentId, file) => {
  if (!file?.buffer?.length) throw invalid("Choose an image to upload.");
  if (!IMAGE_TYPES.includes(file.mimetype)) throw invalid("Use a JPG, PNG, WebP or GIF image.");
  if (file.size > IMAGE_LIMITS.maxBytes) throw invalid("The image is larger than 5 MB.");
  const { data, width, height } = await compressImage(file.buffer);
  const key = `${KEY_PREFIX}${assessmentId}/${randomUUID()}.webp`;
  await storage.put(key, data, { contentType: "image/webp" });
  return { key, width, height, bytes: data.length };
};

/** Validate an image reference from the editor: it must belong to this assessment and have alt text. */
export const normalizeImageRef = (ref, assessmentId) => {
  if (ref === null || ref === undefined || ref === "") return null;
  const key = String(ref.key || "");
  if (!new RegExp(`^${KEY_PREFIX}${assessmentId}/[\\w-]+\\.webp$`).test(key)) throw invalid("Upload the image again.");
  const alt = String(ref.alt || "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, IMAGE_LIMITS.altMax);
  if (!alt) throw invalid("Every image needs a short description (alt text) for students who cannot see it.");
  return { key, alt };
};

/** Option images: one entry (or null) per MCQ option; null overall when none is set. */
export const normalizeOptionImages = (refs, optionCount, assessmentId) => {
  if (!Array.isArray(refs) || refs.every((r) => !r)) return null;
  if (refs.length !== optionCount) throw invalid("Each option image must belong to an option.");
  return refs.map((r) => normalizeImageRef(r, assessmentId));
};

const isImageRef = (value) =>
  value && typeof value === "object" && !Array.isArray(value) && typeof value.key === "string" && value.key.startsWith(KEY_PREFIX) && "alt" in value && !("url" in value);

/** Replace every { key, alt } image reference in a response body with { url, alt } (signed, short-lived). */
export const signImages = async (body, baseUrl) => {
  const visit = async (value) => {
    if (Array.isArray(value)) return Promise.all(value.map(visit));
    if (!value || typeof value !== "object" || value instanceof Date || Buffer.isBuffer(value)) return value;
    if (isImageRef(value)) {
      try {
        const { url } = await storage.signedUrl(value.key, { contentType: "image/webp", baseUrl, expiresIn: 3600 });
        // The key stays (the editor saves it back); it is useless without a signature.
        return { key: value.key, url, alt: value.alt };
      } catch {
        return { key: value.key, url: null, alt: value.alt };
      }
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await visit(v);
    return out;
  };
  return visit(body);
};

/** Express middleware: sign image references in JSON responses of this router. */
export const signImageUrls = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (!body || !JSON.stringify(body).includes(KEY_PREFIX)) return json(body);
    signImages(body, publicBaseUrl(req)).then(json, next);
    return res;
  };
  next();
};

/** Image bytes as a data: URI, for PDFs and DOCX (null if the file is missing). */
export const imageBytes = async (ref) => {
  if (!ref?.key) return null;
  try {
    return await storage.get(ref.key);
  } catch {
    return null;
  }
};
