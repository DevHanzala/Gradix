import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import { escapeHtml, escapeHtmlMultiline } from "../../utils/escapeHtml.js";
import { normalizeOptions, canonicalOptionIndex, parseBoolean, decodeStoredValue, matchingOptions, parseMatchingRule, parseBlankRule, BLANK_MARKER } from "../../utils/grading.js";
import { imageBytes } from "../questions/questionImages.js";
import { translate, isRtl, normalizeLanguage } from "../../helper/i18n.js";
import { pdfFontCss } from "../../helper/pdfFonts.js";
import { pdfRenderer } from "../../helper/pdfRenderer.js";

/**
 * Printed papers as PDF (Chromium) or DOCX. Labels are in the paper's
 * language; header VALUES (institute, teacher, subject...) are printed
 * exactly as typed: proper nouns are never translated.
 * Every paper gets a code (A, B, C...) when several are printed, and one
 * combined answer key closes the document.
 */
const letter = (i) => String.fromCharCode(65 + i);

export const answerText = (q, language) => {
  if (q.question_type === "multiple_choice") {
    const options = normalizeOptions(q.options);
    const index = canonicalOptionIndex(q.correct_answer, options);
    return index === null ? String(decodeStoredValue(q.correct_answer) ?? "") : `${letter(index)} – ${options[index]}`;
  }
  if (q.question_type === "true_false") {
    const value = parseBoolean(q.correct_answer);
    return value === null ? "" : `${letter(value ? 0 : 1)} – ${translate(language, value ? "paper.true" : "paper.false")}`;
  }
  if (q.question_type === "fill_blank") {
    return parseBlankRule(q.correct_answer)
      .map((accepted, i) => `(${i + 1}) ${accepted.join(" / ")}`)
      .join("   ");
  }
  if (q.question_type === "matching") {
    const { right } = matchingOptions(q.options);
    const { pairs } = parseMatchingRule(q.correct_answer);
    return Object.keys(pairs)
      .sort((a, b) => a - b)
      .map((i) => `${Number(i) + 1}–${letter(right.findIndex((r) => r === pairs[i]))}`)
      .join(", ");
  }
  const rule = decodeStoredValue(q.correct_answer);
  if (rule && typeof rule === "object") return rule.answer || (rule.rubric || []).map((r) => r.concept).join(", ") || (rule.required_keywords || []).join(", ");
  return String(rule ?? "");
};

const choicesOf = (q, language) =>
  q.question_type === "multiple_choice"
    ? normalizeOptions(q.options)
    : q.question_type === "true_false"
      ? [translate(language, "paper.true"), translate(language, "paper.false")]
      : null;

/** A fill-in-the-blank stem as printed: [[1]] becomes a numbered line. */
const printedStem = (q) => (q.question_type === "fill_blank" ? String(q.question_text).replace(BLANK_MARKER, (_, n) => `(${n}) __________`) : q.question_text);

/**
 * Load each question's images once before rendering: data URIs for the PDF, PNG
 * bytes (Word cannot show WebP) with a print size for the DOCX.
 */
const MAX_PRINT_WIDTH = 360;
const loadImage = async (ref, { png }) => {
  const bytes = await imageBytes(ref);
  if (!bytes) return null;
  const { loadImage: decode, createCanvas } = await import("@napi-rs/canvas");
  const image = await decode(bytes);
  const scale = Math.min(1, MAX_PRINT_WIDTH / image.width);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  if (!png) return { alt: ref.alt, src: `data:image/webp;base64,${bytes.toString("base64")}`, width, height };
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext("2d").drawImage(image, 0, 0);
  return { alt: ref.alt, data: await canvas.encode("png"), width, height };
};
export const preloadImages = async (sets, { png = false } = {}) => {
  for (const set of sets) {
    for (const q of set.questions) {
      q.printImage = q.image ? await loadImage(q.image, { png }) : null;
      q.printOptionImages = Array.isArray(q.option_images) ? await Promise.all(q.option_images.map((r) => (r ? loadImage(r, { png }) : null))) : null;
    }
  }
  return sets;
};

const headerRows = (headers) =>
  [
    ["paper.teacher", headers.teacherName],
    ["paper.subject", headers.subjectName],
    ["paper.date", headers.paperDate],
    ["paper.time", headers.paperTime],
  ].filter(([, value]) => value);

// ------------------------------------------------------------------- PDF

export const renderPaperHtml = ({ sets, headers, form = {}, language: lang }) => {
  const language = normalizeLanguage(lang);
  const dir = isRtl(language) ? "rtl" : "ltr";
  const fonts = pdfFontCss(language);
  const t = (key, params) => escapeHtml(translate(language, key, params));
  const multiple = sets.length > 1;
  const q = Number(form.questionFontSize) || 10;
  const o = Number(form.optionFontSize) || 9;
  const h = Number(form.headerFontSize) || 18;

  const header = (set) => `
    <h1 class="institute"><bdi>${escapeHtml(headers.instituteName || "")}</bdi></h1>
    ${multiple ? `<p class="code">${t("paper.paperCode", { code: set.code })}</p>` : ""}
    <table class="info"><tbody>
      ${headerRows(headers)
        .map(([key, value]) => `<tr><td class="label">${t(key)}:</td><td><bdi>${escapeHtml(value)}</bdi></td></tr>`)
        .join("")}
      <tr><td class="label">${t("paper.studentName")}:</td><td class="blank"></td></tr>
    </tbody></table>
    <hr/>
    ${headers.notes ? `<p class="notes">${escapeHtmlMultiline(headers.notes)}</p>` : ""}`;

  const img = (image, cls = "qimg") => (image ? `<img class="${cls}" src="${image.src}" alt="${escapeHtml(image.alt)}"/>` : "");
  const questionsHtml = (set) =>
    set.questions
      .map((question, i) => {
        const choices = choicesOf(question, language);
        let body;
        if (question.question_type === "matching") {
          const { left, right } = matchingOptions(question.options);
          body = `<p class="hint">${t("paper.matchingHint")}</p><table class="matching"><tbody>${left
            .map(
              (l, li) =>
                `<tr><td><bdi>${li + 1}. ${escapeHtml(l)}</bdi></td><td class="slot">____</td><td><bdi>${letter(li)}. ${escapeHtml(right[li] ?? "")}</bdi></td></tr>`
            )
            .join("")}</tbody></table>`;
        } else if (question.question_type === "fill_blank") {
          body = "";
        } else if (choices) {
          body = `<div class="options">${choices
            .map(
              (c, ci) =>
                `<div class="option"><span class="circle">${letter(ci)}</span><bdi>${escapeHtml(c)}</bdi>${img(question.printOptionImages?.[ci], "oimg")}</div>`
            )
            .join("")}</div>`;
        } else {
          body = `<div class="lines"><div></div><div></div><div></div></div>`;
        }
        return `<div class="question"><p><strong><bdi>${i + 1}.</bdi></strong> <bdi>${escapeHtml(printedStem(question))}</bdi></p>${img(question.printImage)}${body}</div>`;
      })
      .join("");

  const papers = sets.map((set, i) => `<section class="paper${i ? " break" : ""}">${header(set)}${questionsHtml(set)}</section>`).join("");
  const key = `<section class="paper break key">
      <h2>${t("paper.answerKey")}</h2>
      ${sets
        .map(
          (set) => `${multiple ? `<h3>${t("paper.paperCode", { code: set.code })}</h3>` : ""}
            <ol class="answers">${set.questions.map((question) => `<li><bdi>${escapeHtml(answerText(question, language))}</bdi></li>`).join("")}</ol>`
        )
        .join("")}
    </section>`;

  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head><meta charset="UTF-8"/><style>
  ${fonts.css}
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${fonts.family}; line-height: ${fonts.lineHeight}; font-size: ${q}pt; color: #1a1a2e; }
  .paper { padding: 4px 6px; } .break { page-break-before: always; }
  .institute { text-align: center; font-size: ${h}pt; font-weight: 800; color: #1a1a6e; margin-bottom: 8px; }
  .code { text-align: center; font-weight: 700; margin-bottom: 10px; }
  .info td { padding: 2px 6px; } .info .label { font-weight: 700; white-space: nowrap; }
  .info .blank { border-bottom: 1px solid #999; min-width: 220px; }
  hr { border: none; border-top: 2px solid #1a1a2e; margin: 12px 0 16px; }
  .notes { font-size: ${o}pt; color: #555; font-style: italic; margin-bottom: 14px; }
  .question { margin-bottom: 16px; break-inside: avoid; } .question p { margin-bottom: 6px; }
  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; padding-inline-start: 16px; font-size: ${o}pt; }
  .option { display: flex; align-items: center; gap: 8px; }
  .circle { display: inline-flex; width: 18px; height: 18px; border: 1.5px solid #333; border-radius: 50%; align-items: center; justify-content: center; font-size: ${o - 1}pt; font-weight: 700; flex-shrink: 0; }
  .lines div { border-bottom: 1px solid #999; height: 22px; margin-inline-start: 16px; }
  .key h2 { text-align: center; font-size: ${h}pt; margin-bottom: 18px; } .key h3 { margin: 12px 0 6px; }
  .answers { padding-inline-start: 24px; } .answers li { margin-bottom: 4px; }
  .qimg { display: block; max-width: 360px; max-height: 220px; margin: 4px 16px 8px; }
  .oimg { display: block; max-width: 140px; max-height: 90px; margin-top: 4px; }
  .hint { font-size: ${o}pt; color: #555; margin-inline-start: 16px; }
  .matching { margin-inline-start: 16px; border-collapse: collapse; font-size: ${o}pt; } .matching td { padding: 3px 10px; vertical-align: top; }
  .matching .slot { color: #777; }
</style></head>
<body>${papers}${key}</body></html>`;
};

export const renderPaperPdf = async (args) => {
  await preloadImages(args.sets);
  return pdfRenderer.render(renderPaperHtml(args), { format: args.form?.pageSize || "A4" });
};

// ------------------------------------------------------------------ DOCX

export const renderPaperDocx = async ({ sets, headers, language: lang }) => {
  await preloadImages(sets, { png: true });
  const language = normalizeLanguage(lang);
  const rtl = isRtl(language);
  const font = language === "ur" ? "Noto Nastaliq Urdu" : rtl ? "Noto Naskh Arabic" : "Calibri";
  const align = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const run = (text, extra = {}) => new TextRun({ text: String(text ?? ""), font, rightToLeft: rtl, ...extra });
  const para = (children, extra = {}) => new Paragraph({ children, bidirectional: rtl, alignment: align, ...extra });
  const multiple = sets.length > 1;

  const children = [];
  sets.forEach((set, s) => {
    if (s > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ children: [run(headers.instituteName || "", { bold: true, size: 32 })], alignment: AlignmentType.CENTER, bidirectional: rtl }));
    if (multiple) children.push(new Paragraph({ children: [run(translate(language, "paper.paperCode", { code: set.code }), { bold: true })], alignment: AlignmentType.CENTER, bidirectional: rtl }));
    for (const [key, value] of headerRows(headers)) {
      children.push(para([run(`${translate(language, key)}: `, { bold: true }), run(value)]));
    }
    children.push(para([run(`${translate(language, "paper.studentName")}: ______________________________`, { bold: true })]));
    if (headers.notes) children.push(para([run(headers.notes, { italics: true })]));
    children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "1A1A2E" } }, children: [] }));
    const picture = (image) =>
      new ImageRun({ type: "png", data: image.data, transformation: { width: image.width, height: image.height }, altText: { name: image.alt, description: image.alt, title: image.alt } });
    set.questions.forEach((question, i) => {
      children.push(para([run(`${i + 1}. `, { bold: true }), run(printedStem(question), { bold: true })], { spacing: { before: 200, after: 80 } }));
      if (question.printImage) children.push(para([picture(question.printImage)], { indent: { start: 360 } }));
      const choices = choicesOf(question, language);
      if (question.question_type === "matching") {
        const { left, right } = matchingOptions(question.options);
        children.push(para([run(translate(language, "paper.matchingHint"), { italics: true })], { indent: { start: 360 } }));
        left.forEach((l, li) => children.push(para([run(`${li + 1}. ${l}   ____   ${letter(li)}. ${right[li] ?? ""}`)], { indent: { start: 360 } })));
      } else if (question.question_type === "fill_blank") {
        // The blanks are in the question line itself.
      } else if (choices) {
        choices.forEach((c, ci) => {
          children.push(para([run(`(${letter(ci)}) `), run(c)], { indent: { start: 360 } }));
          const optionImage = question.printOptionImages?.[ci];
          if (optionImage) children.push(para([picture({ ...optionImage, width: Math.min(optionImage.width, 140), height: Math.round(optionImage.height * (Math.min(optionImage.width, 140) / optionImage.width)) })], { indent: { start: 720 } }));
        });
      } else {
        for (let l = 0; l < 3; l++) children.push(para([run("_".repeat(70))], { indent: { start: 360 } }));
      }
    });
  });

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(translate(language, "paper.answerKey"), { bold: true })], alignment: AlignmentType.CENTER, bidirectional: rtl }));
  for (const set of sets) {
    if (multiple) children.push(para([run(translate(language, "paper.paperCode", { code: set.code }), { bold: true })], { spacing: { before: 200 } }));
    set.questions.forEach((question, i) => children.push(para([run(`${i + 1}. `, { bold: true }), run(answerText(question, language))])));
  }

  const doc = new Document({ creator: "Gradix", title: headers.instituteName || "Gradix", sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
};
