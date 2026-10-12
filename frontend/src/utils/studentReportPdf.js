import { jsPDF } from "jspdf";

const MARGIN = 15;
const PAGE_WIDTH = 210;
const LINE = 6;

/**
 * Text-based PDF of one assessment report (score, stats, weak areas, study plan).
 * Uses jsPDF's built-in Latin font: report labels are English; student content
 * in other scripts is kept in the on-screen review (full RTL/i18n is Phase 2).
 */
export const buildStudentReportPdf = async (report) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensureSpace = (needed = LINE) => {
    if (y + needed > 297 - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const heading = (text, size = 13) => {
    ensureSpace(LINE * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.text(text, MARGIN, y);
    y += LINE + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  };
  const paragraph = (text) => {
    const lines = doc.splitTextToSize(String(text ?? ""), PAGE_WIDTH - MARGIN * 2);
    for (const line of lines) {
      ensureSpace();
      doc.text(line, MARGIN, y);
      y += LINE;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Gradix assessment report", MARGIN, y);
  y += LINE + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  paragraph(`Assessment: ${report.assessment_title || "-"}`);
  paragraph(`Generated: ${new Date(report.generated_at || Date.now()).toLocaleString()}`);
  y += 2;

  heading("Results");
  const minutes = Math.floor((Number(report.time_taken) || 0) / 60);
  const seconds = (Number(report.time_taken) || 0) % 60;
  paragraph(`Score: ${report.student_score ?? 0} / ${report.total_marks ?? 0} (${report.score ?? 0}%)`);
  paragraph(`Correct: ${report.correct_answers ?? 0}   Incorrect: ${report.incorrect_answers ?? 0}   Questions: ${report.total_questions ?? 0}`);
  paragraph(`Negative marks applied: ${report.negative_marks_applied ?? 0}`);
  paragraph(`Time taken: ${minutes}m ${seconds}s`);

  const rec = report.recommendations || {};
  const weak = Array.isArray(rec.weak_areas) ? rec.weak_areas : [];
  heading("Areas to improve");
  if (weak.length === 0) paragraph("No specific weak areas were identified.");
  weak.forEach((area, i) => {
    paragraph(`${i + 1}. ${area.topic || "General"}${area.performance !== undefined ? ` (${area.performance}%)` : ""}`);
    if (area.suggestion) paragraph(`   ${area.suggestion}`);
  });

  const plan = rec.study_plan || {};
  heading("Study plan");
  const daily = Array.isArray(plan.daily_practice) ? plan.daily_practice : [];
  const weekly = Array.isArray(plan.weekly_review) ? plan.weekly_review : [];
  if (daily.length === 0 && weekly.length === 0) paragraph("Keep practising regularly.");
  if (daily.length) {
    paragraph("Daily practice:");
    daily.forEach((d) => paragraph(`  - ${d.topic || ""}: ${d.focus || ""}${d.time_allocation ? ` (${d.time_allocation})` : ""}`));
  }
  if (weekly.length) {
    paragraph("Weekly review:");
    weekly.forEach((w) => paragraph(`  - ${w.topic || ""}: ${w.activity || ""}${w.goal ? ` - goal: ${w.goal}` : ""}`));
  }

  return doc;
};
