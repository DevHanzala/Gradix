import db from "../DB/db.js";
import { notify } from "./notification.service.js";
import { sendAssessmentPublishedEmail, sendResultsReadyEmail } from "../helper/emailService.js";

/**
 * Notifications for assessment lifecycle events (in-app + email in the
 * recipient's language). Called after the triggering change has committed;
 * failures are logged and never undo the change.
 */

/** Every enrolled student hears that the assessment is available. */
export const notifyPublished = async (assessmentId) => {
  try {
    const { rows } = await db.query(
      `SELECT a.title, u.id, u.name, u.email, u.language_preference
       FROM assessments a JOIN enrollments e ON e.assessment_id = a.id JOIN users u ON u.id = e.student_id
       WHERE a.id = $1 AND u.deleted_at IS NULL`,
      [assessmentId]
    );
    for (const s of rows) {
      await notify(s.id, "published", { assessmentId, title: s.title });
      sendAssessmentPublishedEmail(s, s.title);
    }
  } catch (error) {
    console.error(`[notify] published ${assessmentId}: ${error.message}`);
  }
};

/** The student hears that their results are ready. */
export const notifyResultsReady = async (attempt) => {
  try {
    const { rows } = await db.query(
      `SELECT a.title, u.id, u.name, u.email, u.language_preference
       FROM assessments a JOIN users u ON u.id = $2 WHERE a.id = $1 AND u.deleted_at IS NULL`,
      [attempt.assessment_id, attempt.student_id]
    );
    const s = rows[0];
    if (!s) return;
    const percentage = Number(attempt.raw_percentage ?? 0);
    await notify(s.id, "results_ready", { assessmentId: attempt.assessment_id, title: s.title, percentage });
    sendResultsReadyEmail(s, s.title, percentage, attempt.assessment_id);
  } catch (error) {
    console.error(`[notify] results ${attempt.id}: ${error.message}`);
  }
};
