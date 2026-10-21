import { findEnrolledAssessmentsWithStatusQuery } from "../repositories/studentAnalyticsRepository.js";
import { availableLanguages } from "./assessmentAvailability.js";

/**
 * Student dashboard list. Per-assessment results, study plans, reports and
 * practice live in services/learning/*.
 */

// One row per enrolled assessment with a reliable status, so the dashboard
// never offers "Start" for an assessment the student already completed.
export const getStudentAssessmentsService = async (studentId, userRole) => {
  if (userRole !== "student") {
    throw new Error("UNAUTHORIZED_ROLE");
  }

  const rows = await findEnrolledAssessmentsWithStatusQuery(studentId);
  return {
    data: rows.map((r) => {
      const status = !r.attempt_id ? "not_started" : r.attempt_status === "completed" ? "completed" : "in_progress";
      // Pool attempts know their full plan (incl. questions never reached); Phase 1 ones sum their questions.
      const attemptMarks = Number(r.plan_marks) > 0 ? Number(r.plan_marks) : Number(r.attempt_marks);
      const totalMarks = Number(status === "not_started" ? r.planned_marks : attemptMarks) || 0;
      const score = r.score === null || r.score === undefined ? null : Number(r.score);
      return {
        id: r.id,
        title: r.title,
        description: r.prompt ? r.prompt.slice(0, 140) : "",
        status,
        attempt_id: r.attempt_id,
        question_count: Number(r.question_count) || 0,
        duration_seconds: Number(r.duration_seconds) || 0,
        total_marks: totalMarks,
        score: status === "completed" ? score : null,
        percentage:
          status !== "completed"
            ? null
            : r.raw_percentage !== null && r.raw_percentage !== undefined
              ? Number(r.raw_percentage)
              : totalMarks > 0
                ? Math.round(((score || 0) / totalMarks) * 10000) / 100
                : null,
        // Languages a student can start in right now (empty: not published yet).
        available_languages: availableLanguages(r),
        enrolled_at: r.enrolled_at,
        started_at: r.started_at,
        completed_at: r.completed_at,
      };
    }),
  };
};

