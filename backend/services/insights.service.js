import db from "../DB/db.js";
import { requireAssessmentAccess } from "./assessmentAccess.js";
import { findObjectivesQuery } from "../repositories/objectiveRepository.js";

/**
 * Instructor analytics for one assessment, computed from completed online
 * attempts: score distribution, objective accuracy (hardest first),
 * difficulty reached, and a per-student table for CSV/Excel export.
 * Questions a student never reached count as not correct.
 */
const round = (n) => Math.round(n * 10) / 10;
const BUCKETS = 10; // 0-9, 10-19, ..., 90-100

const loadAttempts = async (assessmentId) => {
  const { rows: attempts } = await db.query(
    `SELECT aa.id, aa.student_id, u.name, u.email, aa.language, aa.score, aa.raw_percentage, aa.adjusted_percentage,
            aa.plan, aa.started_at, aa.completed_at
     FROM assessment_attempts aa JOIN users u ON u.id = aa.student_id
     WHERE aa.assessment_id = $1 AND aa.status = 'completed' AND aa.is_physical_paper = FALSE AND aa.superseded = FALSE
     ORDER BY aa.completed_at`,
    [assessmentId]
  );
  const { rows: answers } = await db.query(
    `SELECT gq.attempt_id, gq.objective_id, gq.difficulty, gq.question_order, gq.positive_marks,
            COALESCE(sa.is_correct, FALSE) AS is_correct,
            (sa.student_answer IS NOT NULL AND sa.student_answer <> '') AS answered
     FROM generated_questions gq
     JOIN assessment_attempts aa ON aa.id = gq.attempt_id
     LEFT JOIN student_answers sa ON sa.question_id = gq.id
     WHERE aa.assessment_id = $1 AND aa.status = 'completed' AND aa.is_physical_paper = FALSE AND aa.superseded = FALSE
     ORDER BY gq.attempt_id, gq.question_order`,
    [assessmentId]
  );
  const byAttempt = new Map(attempts.map((a) => [a.id, []]));
  for (const row of answers) byAttempt.get(row.attempt_id)?.push(row);
  return attempts.map((a) => {
    const rows = byAttempt.get(a.id) || [];
    const planned = Array.isArray(a.plan) ? a.plan : null;
    const totalMarks = planned ? planned.reduce((s, x) => s + Number(x.positive_marks || 0), 0) : rows.reduce((s, r) => s + Number(r.positive_marks || 0), 0);
    const rawPercentage = a.raw_percentage ?? (totalMarks ? round((Number(a.score || 0) / totalMarks) * 100) : 0);
    const questionCount = planned ? planned.length : rows.length;
    const correct = rows.filter((r) => r.is_correct).length;
    const served = rows.filter((r) => r.difficulty).map((r) => Number(r.difficulty));
    return {
      ...a,
      rows,
      planned,
      rawPercentage: Number(rawPercentage),
      adjustedPercentage: a.adjusted_percentage === null ? null : Number(a.adjusted_percentage),
      questionCount,
      correct,
      answered: rows.filter((r) => r.answered).length,
      timeSeconds: Math.max(0, Math.round((new Date(a.completed_at) - new Date(a.started_at)) / 1000)),
      finalDifficulty: served.length ? served[served.length - 1] : null,
      maxDifficulty: served.length ? Math.max(...served) : null,
    };
  });
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round((sorted[mid - 1] + sorted[mid]) / 2);
};

export const getInsightsData = async (assessmentId, user) => {
  const owned = await requireAssessmentAccess(assessmentId, user);
  const [attempts, objectives] = await Promise.all([loadAttempts(owned.id), findObjectivesQuery(owned.id)]);

  const distribution = Array.from({ length: BUCKETS }, (_, i) => ({ from: i * 10, to: i === BUCKETS - 1 ? 100 : i * 10 + 9, count: 0 }));
  for (const a of attempts) distribution[Math.min(BUCKETS - 1, Math.floor(a.rawPercentage / 10))].count += 1;

  const objectiveStats = new Map(objectives.map((o, i) => [o.id, { objectiveId: o.id, number: i + 1, text: o.text, questions: 0, correct: 0 }]));
  for (const a of attempts) {
    const servedPerObjective = new Map();
    for (const r of a.rows) {
      const stat = objectiveStats.get(r.objective_id);
      if (!stat) continue;
      stat.questions += 1;
      stat.correct += r.is_correct ? 1 : 0;
      servedPerObjective.set(r.objective_id, (servedPerObjective.get(r.objective_id) || 0) + 1);
    }
    for (const slot of a.planned || []) {
      const stat = objectiveStats.get(slot.objective_id);
      if (!stat) continue;
      if ((servedPerObjective.get(slot.objective_id) || 0) > 0) servedPerObjective.set(slot.objective_id, servedPerObjective.get(slot.objective_id) - 1);
      else stat.questions += 1; // never reached
    }
  }
  const objectivesOut = [...objectiveStats.values()].map((o) => ({ ...o, accuracy: o.questions ? round((o.correct / o.questions) * 100) : null }));
  const hardest = objectivesOut.filter((o) => o.accuracy !== null).sort((a, b) => a.accuracy - b.accuracy).slice(0, 3);

  const difficultyReached = [1, 2, 3, 4, 5].map((level) => ({
    level,
    final: attempts.filter((a) => a.finalDifficulty === level).length,
    highest: attempts.filter((a) => a.maxDifficulty === level).length,
  }));

  const raw = attempts.map((a) => a.rawPercentage);
  const adjusted = attempts.map((a) => a.adjustedPercentage).filter((v) => v !== null);
  return {
    assessmentId: owned.id,
    title: owned.title,
    summary: {
      students: attempts.length,
      averageRaw: raw.length ? round(raw.reduce((s, v) => s + v, 0) / raw.length) : null,
      medianRaw: median(raw),
      averageAdjusted: adjusted.length ? round(adjusted.reduce((s, v) => s + v, 0) / adjusted.length) : null,
      averageTimeSeconds: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.timeSeconds, 0) / attempts.length) : null,
    },
    distribution,
    objectives: objectivesOut,
    hardestObjectives: hardest,
    difficultyReached,
    attempts,
  };
};

/** Public JSON (no per-question rows). */
export const getInsightsService = async (assessmentId, user) => {
  const { attempts, ...rest } = await getInsightsData(assessmentId, user);
  const students = attempts.map((a) => {
    const copy = { ...a };
    delete copy.rows;
    delete copy.planned;
    delete copy.plan;
    return copy;
  });
  return { ...rest, students };
};

// ------------------------------------------------------------------ export

/** Spreadsheet formula injection guard: text cells starting with = + - @ are prefixed. */
export const safeCell = (value) => (typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

const exportRows = (data) => {
  const objectiveHeaders = data.objectives.map((o) => `O${o.number}: ${o.text}`);
  const header = ["Student", "Email", "Language", "Score %", "Adjusted %", "Correct", "Answered", "Questions", "Time (s)", "Final difficulty", "Completed at", ...objectiveHeaders];
  const rows = data.attempts.map((a) => {
    const perObjective = data.objectives.map((o) => {
      const own = a.rows.filter((r) => r.objective_id === o.objectiveId);
      const planned = (a.planned || []).filter((s) => s.objective_id === o.objectiveId).length || own.length;
      return planned ? round((own.filter((r) => r.is_correct).length / planned) * 100) : "";
    });
    return [
      a.name,
      a.email,
      a.language,
      a.rawPercentage,
      a.adjustedPercentage ?? "",
      a.correct,
      a.answered,
      a.questionCount,
      a.timeSeconds,
      a.finalDifficulty ?? "",
      new Date(a.completed_at).toISOString(),
      ...perObjective,
    ];
  });
  return [header, ...rows].map((r) => r.map(safeCell));
};

const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportInsightsService = async (assessmentId, user, format = "csv") => {
  const data = await getInsightsData(assessmentId, user);
  const rows = exportRows(data);
  if (format === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gradix";
    const sheet = workbook.addWorksheet("Results");
    rows.forEach((r) => sheet.addRow(r));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const objectiveSheet = workbook.addWorksheet("Objectives");
    objectiveSheet.addRow(["Objective", "Questions", "Correct", "Accuracy %"]);
    data.objectives.forEach((o) => objectiveSheet.addRow([safeCell(`O${o.number}: ${o.text}`), o.questions, o.correct, o.accuracy ?? ""]));
    objectiveSheet.getRow(1).font = { bold: true };
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx" };
  }
  // UTF-8 BOM so Excel opens Urdu/Arabic names correctly.
  const csv = "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  return { buffer: Buffer.from(csv, "utf8"), contentType: "text/csv; charset=utf-8", extension: "csv" };
};
