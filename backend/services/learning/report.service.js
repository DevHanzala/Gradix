import db from "../../DB/db.js";
import { escapeHtml } from "../../utils/escapeHtml.js";
import { pdfFontCss } from "../../helper/pdfFonts.js";
import { pdfRenderer } from "../../helper/pdfRenderer.js";
import { translate, normalizeLanguage, isRtl, formatDateTime } from "../../helper/i18n.js";
import { getResultsService } from "./results.service.js";
import { findReportQuery } from "./studyPlan.service.js";
import { createPracticeService } from "./practice.service.js";
import { normalizeOptions, decodeStoredValue } from "../../utils/grading.js";

/**
 * Server-rendered PDF learning report in the student's language (Puppeteer,
 * embedded Nastaliq/Naskh fonts). The PDF is stored in learning_reports and
 * re-used until the study plan changes (saving a plan clears the stored PDF).
 */
const LOCALES = { en: "en-GB", ur: "ur-PK", ar: "ar", fa: "fa-IR" };

const reportHtml = ({ results, plan, practice = [], language }) => {
  const t = (key, params) => escapeHtml(translate(language, key, params));
  const num = (n, opts) => new Intl.NumberFormat(LOCALES[language], opts).format(Number(n) || 0);
  const pct = (n) => num((Number(n) || 0) / 100, { style: "percent", maximumFractionDigits: 1 });
  const dir = isRtl(language) ? "rtl" : "ltr";
  const fonts = pdfFontCss(language);
  const text = (s) => `<span dir="auto">${escapeHtml(s)}</span>`;

  const objectivesRows = results.objectives
    .map(
      (o) => `<tr>
        <td>${num(o.number)}. ${text(o.text)}</td>
        <td class="num">${num(o.correct)} / ${num(o.questions)}</td>
        <td class="num">${pct(o.accuracy)}</td>
        <td><div class="bar"><div style="width:${Math.max(0, Math.min(100, o.accuracy))}%"></div></div></td>
      </tr>`
    )
    .join("");

  const weak = results.weakAreas.length
    ? `<ul>${results.weakAreas.map((o) => `<li>${text(o.text)} — ${pct(o.accuracy)}</li>`).join("")}</ul>`
    : `<p>${t("report.noWeakAreas")}</p>`;

  const planHtml = plan
    ? `<h2>${t("report.studyPlan")}</h2>
       ${plan.summary ? `<p>${text(plan.summary)}</p>` : ""}
       ${plan.steps
         .map(
           (s, i) => `<div class="step">
             <h3>${num(i + 1)}. ${text(s.focus)}</h3>
             ${s.why ? `<p class="muted">${text(s.why)}</p>` : ""}
             <ul>${s.activities.map((a) => `<li>${text(a)}</li>`).join("")}</ul>
             ${(s.passages || [])
               .map((p) => `<blockquote><strong>${text(p.resourceName)}</strong><br/>${text(p.excerpt)}…</blockquote>`)
               .join("")}
           </div>`
         )
         .join("")}
       ${plan.encouragement ? `<p><em>${text(plan.encouragement)}</em></p>` : ""}`
    : `<p class="muted">${t("report.noStudyPlan")}</p>`;

  // Practice questions (never exam questions, see practice.service.js); answers at the end.
  const letter = (i) => String.fromCharCode(65 + i);
  const answerText = (q) => {
    const answer = decodeStoredValue(q.correct_answer);
    if (q.question_type === "true_false") return t(String(answer).toLowerCase() === "true" ? "paper.true" : "paper.false");
    const options = normalizeOptions(q.options) || [];
    const at = options.findIndex((o) => String(o) === String(answer));
    return at >= 0 ? `${letter(at)}. ${text(options[at])}` : text(answer);
  };
  const practiceHtml = practice.length
    ? `<h2>${t("report.practice")}</h2>
       <p class="muted">${t("report.practiceIntro")}</p>
       <ol class="practice">${practice
         .map((q) => {
           const options =
             q.question_type === "true_false"
               ? [t("paper.true"), t("paper.false")]
               : (normalizeOptions(q.options) || []).map((o) => text(o));
           return `<li>${text(q.question_text)}<ul class="options">${options.map((o, i) => `<li>${letter(i)}. ${o}</li>`).join("")}</ul></li>`;
         })
         .join("")}</ol>
       <h3>${t("report.practiceAnswers")}</h3>
       <ol class="answers">${practice.map((q) => `<li>${answerText(q)}</li>`).join("")}</ol>`
    : `<h2>${t("report.practice")}</h2><p class="muted">${t("report.noPractice")}</p>`;

  const path = results.difficultyPath.filter((p) => p.difficulty);
  const pathHtml = path.length
    ? `<h2>${t("report.difficultyPath")}</h2>
       <div class="path" dir="ltr">${path
         .map((p) => `<span class="${p.correct ? "ok" : "bad"}" style="height:${p.difficulty * 14}px" title="${p.difficulty}"></span>`)
         .join("")}</div>
       <p class="muted">${t("report.difficultyLegend")}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head><meta charset="UTF-8"/><style>
  ${fonts.css}
  * { box-sizing: border-box; }
  body { font-family: ${fonts.family}; line-height: ${fonts.lineHeight}; color: #111827; background: #fff; font-size: 11pt; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4px; } h2 { font-size: 14pt; margin: 22px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 11.5pt; margin: 10px 0 4px; }
  .muted { color: #4b5563; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
  .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; }
  .stat b { display: block; font-size: 15pt; }
  table { width: 100%; border-collapse: collapse; } td { padding: 5px 4px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  td.num { white-space: nowrap; text-align: center; }
  .bar { background: #eef2ff; border-radius: 4px; height: 8px; width: 120px; } .bar div { background: #4f46e5; height: 8px; border-radius: 4px; }
  blockquote { margin: 6px 0; padding: 6px 10px; background: #f8fafc; border-inline-start: 3px solid #c7d2fe; font-size: 10pt; }
  .path { display: flex; align-items: flex-end; gap: 3px; height: 76px; }
  .path span { width: 10px; border-radius: 3px 3px 0 0; } .path .ok { background: #059669; } .path .bad { background: #dc2626; }
  .step, .practice > li { break-inside: avoid; }
  .practice > li { margin-bottom: 8px; } .options { list-style: none; padding-inline-start: 12px; margin: 4px 0; }
  .answers { font-size: 10pt; }
  footer { margin-top: 24px; font-size: 9pt; color: #6b7280; }
</style></head>
<body>
  <h1>${text(results.title)}</h1>
  <p class="muted">${t("report.subtitle", { date: formatDateTime(language, new Date(results.completedAt || Date.now())) })}</p>
  <div class="stats">
    <div class="stat">${t("report.score")}<b>${pct(results.scores.rawPercentage)}</b></div>
    <div class="stat">${t("report.adjusted")}<b>${results.scores.adjustedPercentage === null ? "–" : pct(results.scores.adjustedPercentage)}</b></div>
    <div class="stat">${t("report.accuracy")}<b>${pct(results.accuracy.percentage)}</b></div>
    <div class="stat">${t("report.correct")}<b>${num(results.accuracy.correct)} / ${num(results.accuracy.totalQuestions)}</b></div>
  </div>
  <h2>${t("report.byObjective")}</h2>
  ${results.objectives.length ? `<table>${objectivesRows}</table>` : `<p class="muted">${t("report.noObjectives")}</p>`}
  <h2>${t("report.weakAreas")}</h2>
  ${weak}
  ${pathHtml}
  ${planHtml}
  ${practiceHtml}
  <footer>${t("report.footer")}</footer>
</body></html>`;
};

/**
 * Practice questions for the report: the student's latest practice set in this
 * language, or a new one (same generator as the "Practice" button). A report is
 * still produced without them if practice is unavailable (no objectives, LLM down).
 */
const practiceForReport = async (student, results, language) => {
  const latest = async () =>
    (
      await db.query(
        `SELECT questions FROM practice_sessions WHERE student_id = $1 AND assessment_id = $2 AND language = $3 ORDER BY id DESC LIMIT 1`,
        [student.id, results.assessmentId, language]
      )
    ).rows[0]?.questions;
  let questions = await latest();
  if (!questions) {
    try {
      await createPracticeService(student, results.assessmentId, { language });
      questions = await latest();
    } catch (error) {
      if (error.code !== "PRACTICE_UNAVAILABLE") console.error(`[report] practice: ${error.message}`);
    }
  }
  return questions || [];
};

export const getReportPdfService = async (student, assessmentId, { language: requested } = {}) => {
  const results = await getResultsService(student.id, assessmentId);
  const language = normalizeLanguage(requested || student.language_preference || results.language);
  const existing = await findReportQuery(results.attemptId, language);
  if (existing?.pdf) return { pdf: existing.pdf, language, cached: true };

  const practice = await practiceForReport(student, results, language);
  const pdf = await pdfRenderer.render(reportHtml({ results, plan: existing?.study_plan || null, practice, language }));
  await db.query(
    `INSERT INTO learning_reports (attempt_id, assessment_id, student_id, language, pdf, pdf_generated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (attempt_id, language) DO UPDATE SET pdf = EXCLUDED.pdf, pdf_generated_at = NOW(), updated_at = NOW()`,
    [results.attemptId, results.assessmentId, student.id, language, pdf]
  );
  return { pdf, language, cached: false };
};

export { reportHtml };
