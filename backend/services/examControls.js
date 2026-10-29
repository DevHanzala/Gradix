import db from "../DB/db.js";
import { AppError } from "../utils/AppError.js";

/**
 * Exam controls per assessment (assessments.exam_settings) and the proctoring log.
 * Proctoring is light by design: the browser reports leaving the tab/window, leaving
 * fullscreen and copy/paste/right-click attempts. No camera, no screen capture.
 */
export const PROCTORING_LEVELS = ["off", "log", "warn", "auto_submit"];
export const EVENT_KINDS = ["tab_hidden", "window_blur", "fullscreen_exit", "copy", "paste", "context_menu"];
export const DEFAULT_EXAM_SETTINGS = {
  proctoring: "off",
  maxViolations: 3,
  windowStart: null,
  windowEnd: null,
  lateJoinMinutes: null,
  timeZone: "Asia/Karachi",
  shuffleOptions: true,
};

const bad = (code, message, status = 400) => new AppError(code, status, message);
const isoOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw bad("INVALID_EXAM_SETTINGS", "Check the exam window dates.");
  return d.toISOString();
};

/** Validate settings from the form (a JSON string or object); unknown keys are dropped. */
export const normalizeExamSettings = (raw, base = DEFAULT_EXAM_SETTINGS) => {
  if (raw === undefined || raw === null || raw === "") return null;
  let input = raw;
  if (typeof raw === "string") {
    try {
      input = JSON.parse(raw);
    } catch {
      throw bad("INVALID_EXAM_SETTINGS", "Exam settings could not be read.");
    }
  }
  const out = { ...DEFAULT_EXAM_SETTINGS, ...base };
  if (input.proctoring !== undefined) {
    if (!PROCTORING_LEVELS.includes(input.proctoring)) throw bad("INVALID_EXAM_SETTINGS", "Unknown proctoring level.");
    out.proctoring = input.proctoring;
  }
  if (input.maxViolations !== undefined) {
    const n = Number(input.maxViolations);
    if (!Number.isInteger(n) || n < 1 || n > 20) throw bad("INVALID_EXAM_SETTINGS", "Auto-submit after 1 to 20 violations.");
    out.maxViolations = n;
  }
  if (input.windowStart !== undefined) out.windowStart = isoOrNull(input.windowStart);
  if (input.windowEnd !== undefined) out.windowEnd = isoOrNull(input.windowEnd);
  if (out.windowStart && out.windowEnd && out.windowEnd <= out.windowStart) throw bad("INVALID_EXAM_SETTINGS", "The window must end after it starts.");
  if (input.lateJoinMinutes !== undefined) {
    const n = input.lateJoinMinutes === null || input.lateJoinMinutes === "" ? null : Number(input.lateJoinMinutes);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 1440)) throw bad("INVALID_EXAM_SETTINGS", "Late join: 0 to 1440 minutes.");
    out.lateJoinMinutes = n;
  }
  if (input.timeZone !== undefined) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timeZone });
      out.timeZone = input.timeZone;
    } catch {
      throw bad("INVALID_EXAM_SETTINGS", "Unknown time zone.");
    }
  }
  if (input.shuffleOptions !== undefined) out.shuffleOptions = input.shuffleOptions === true;
  return out;
};

export const examSettingsOf = (assessment) => ({ ...DEFAULT_EXAM_SETTINGS, ...(assessment?.exam_settings || {}) });

/**
 * When a student may START (an attempt already running is never cut off by the window):
 * not before windowStart, not after windowEnd, and not later than windowStart + lateJoinMinutes.
 */
export const assertWithinWindow = (settings, now = new Date()) => {
  const start = settings.windowStart ? new Date(settings.windowStart) : null;
  const end = settings.windowEnd ? new Date(settings.windowEnd) : null;
  if (start && now < start) throw new AppError("EXAM_NOT_OPEN", 403, `This exam opens at ${start.toISOString()}.`);
  if (end && now > end) throw new AppError("EXAM_CLOSED", 403, "This exam has closed.");
  if (start && settings.lateJoinMinutes !== null && settings.lateJoinMinutes !== undefined) {
    if (now.getTime() > start.getTime() + settings.lateJoinMinutes * 60000) {
      throw new AppError("EXAM_LATE_JOIN_CLOSED", 403, "The time to start this exam has passed.");
    }
  }
};

/** Shuffle MCQ options (and their images) for one student. Grading uses option text, so it is unaffected. */
export const shuffleOptions = (question) => {
  if (question.question_type !== "multiple_choice" || !Array.isArray(question.options)) return question;
  const order = question.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...question,
    options: order.map((i) => question.options[i]),
    option_images: Array.isArray(question.option_images) ? order.map((i) => question.option_images[i] ?? null) : question.option_images,
  };
};

/** The integrity timeline of one attempt (instructor view). */
export const attemptTimeline = async (attemptId) =>
  (await db.query(`SELECT kind, question_index, occurred_at FROM attempt_events WHERE attempt_id = $1 ORDER BY occurred_at, id`, [attemptId])).rows;
