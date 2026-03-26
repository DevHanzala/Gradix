import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";

export const generatePhysicalPaperPDF = async (
  questions,
  headers,
  form,
  isRTL,
  language
) => {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--font-render-hinting=medium",
      ],
    });

    const page = await browser.newPage();

    // ── Font ──────────────────────────────────────────────────────────────────
    const fontPath = path.join(process.cwd(), "fonts/NotoSansArabic-Regular.ttf");
    const fontData = fs.readFileSync(fontPath).toString("base64");

    // ── Labels per language ───────────────────────────────────────────────────
    const labelMap = {
      en: { teacher: "Teacher",  subject: "Subject", date: "Date",          time: "Time",          answerKey: "ANSWER KEY" },
      ar: { teacher: "المعلم",   subject: "المادة",  date: "التاريخ",       time: "الوقت",         answerKey: "مفتاح الإجابات" },
      ur: { teacher: "استاد",    subject: "مضمون",   date: "تاریخ",         time: "وقت",           answerKey: "جوابی کلید" },
      fa: { teacher: "معلم",     subject: "درس",     date: "تاریخ",         time: "زمان",          answerKey: "کلید پاسخ" },
    };
    const lbl = labelMap[language] || labelMap.en;

    // ── Helper: letter label for option index ─────────────────────────────────
    const optionLetter = (index) => String.fromCharCode(65 + index); // A, B, C …

    // ── Build question rows ───────────────────────────────────────────────────
    const questionsHTML = questions
      .map((q, i) => {
        const optionsHTML = (q.options || [])
          .map(
            (opt, oi) => `
            <div class="option-row">
              <span class="option-circle">${optionLetter(oi)}</span>
              <span class="option-text">${optionLetter(oi)}. ${opt}</span>
            </div>`
          )
          .join("");

        return `
          <div class="question-block">
            <p class="question-text"><strong>Q${i + 1}. ${q.question_text}</strong></p>
            <div class="options-grid">${optionsHTML}</div>
          </div>`;
      })
      .join("");

    // ── Build answer key rows ─────────────────────────────────────────────────
    const answerKeyHTML = questions
      .map((q, i) => {
        const correctIndex = (q.options || []).findIndex(
          (opt) => opt === q.correct_answer
        );
        const letter = correctIndex >= 0 ? optionLetter(correctIndex) : "?";
        return `<p class="answer-row"><strong>Q${i + 1}:</strong> ${letter}. ${q.correct_answer || "N/A"}</p>`;
      })
      .join("");

    // ── Info rows — only render if value is provided ──────────────────────────
    const infoLeft = [
      headers.teacherName && `<tr><td class="info-label">${lbl.teacher}:</td><td class="info-value">${headers.teacherName}</td></tr>`,
      headers.subjectName && `<tr><td class="info-label">${lbl.subject}:</td><td class="info-value">${headers.subjectName}</td></tr>`,
    ]
      .filter(Boolean)
      .join("");

    const infoRight = [
      headers.paperDate && `<tr><td class="info-label">${lbl.date}:</td><td class="info-value">${headers.paperDate}</td></tr>`,
      headers.paperTime && `<tr><td class="info-label">${lbl.time}:</td><td class="info-value">${headers.paperTime}</td></tr>`,
    ]
      .filter(Boolean)
      .join("");

    const notesHTML = headers.notes
      ? `<p class="notes-text">${headers.notes}</p>`
      : "";

    // ── Full HTML ─────────────────────────────────────────────────────────────
    const html = `
    <!DOCTYPE html>
    <html lang="${language}" dir="${isRTL ? "rtl" : "ltr"}">
    <head>
      <meta charset="UTF-8" />
      <style>
        /* ── Font ── */
        @font-face {
          font-family: 'NotoSansArabic';
          src: url(data:font/ttf;base64,${fontData}) format('truetype');
        }

        /* ── Base ── */
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: ${isRTL ? "'NotoSansArabic', Arial" : "Arial, Helvetica, sans-serif"};
          font-size: ${form.questionFontSize || 10}pt;
          color: #1a1a2e;
          direction: ${isRTL ? "rtl" : "ltr"};
          padding: 48px 52px;
          position: relative;
        }

        /* ── Watermark ── */
        body::after {
          content: "Gradewise-AI";
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 72pt;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.06);
          white-space: nowrap;
          pointer-events: none;
          z-index: 0;
          letter-spacing: 4px;
        }

        /* ── Institute heading ── */
        .institute-name {
          text-align: center;
          font-size: ${form.headerFontSize || 18}pt;
          font-weight: 900;
          color: #1a1a6e;
          letter-spacing: 1.5px;
          margin-bottom: 22px;
          text-transform: uppercase;
        }

        /* ── Info table ── */
        .info-wrapper {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 6px;
        }
        .info-table {
          border-collapse: collapse;
          flex: 1;
        }
        .info-table td {
          padding: 3px 10px 3px 0;
          vertical-align: top;
          font-size: ${form.questionFontSize || 10}pt;
        }
        .info-label {
          font-weight: 700;
          white-space: nowrap;
          color: #1a1a2e;
          padding-${isRTL ? "left" : "right"}: 10px !important;
        }
        .info-value {
          color: #333;
        }

        /* ── Divider ── */
        .divider {
          border: none;
          border-top: 2px solid #1a1a2e;
          margin: 14px 0 22px;
        }

        /* ── Notes ── */
        .notes-text {
          font-size: ${form.optionFontSize || 9}pt;
          color: #555;
          margin-bottom: 18px;
          font-style: italic;
        }

        /* ── Questions ── */
        .question-block {
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }
        .question-text {
          font-size: ${form.questionFontSize || 10}pt;
          margin-bottom: 8px;
          line-height: 1.5;
        }
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px 20px;
          padding-${isRTL ? "right" : "left"}: 18px;
        }
        .option-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .option-circle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: 1.5px solid #333;
          border-radius: 50%;
          font-size: ${(form.optionFontSize || 9) - 1}pt;
          font-weight: 700;
          flex-shrink: 0;
          color: #1a1a2e;
        }
        .option-text {
          font-size: ${form.optionFontSize || 9}pt;
          line-height: 1.4;
          color: #222;
        }

        /* ── Answer Key page ── */
        .answer-key-page {
          page-break-before: always;
          padding-top: 10px;
          position: relative;
          z-index: 1;
        }
        .answer-key-title {
          text-align: center;
          font-size: ${form.headerFontSize || 18}pt;
          font-weight: 900;
          color: #1a1a6e;
          letter-spacing: 1.5px;
          margin-bottom: 30px;
          text-transform: uppercase;
        }
        .answer-row {
          font-size: ${form.questionFontSize || 10}pt;
          margin-bottom: 12px;
          line-height: 1.5;
          color: #1a1a2e;
        }
        .answer-row strong {
          margin-${isRTL ? "left" : "right"}: 6px;
        }
      </style>
    </head>
    <body>

      <!-- Institute Name -->
      <h1 class="institute-name">${headers.instituteName || ""}</h1>

      <!-- Info rows -->
      ${infoLeft || infoRight ? `
      <div class="info-wrapper">
        <table class="info-table"><tbody>${infoLeft}</tbody></table>
        <table class="info-table"><tbody>${infoRight}</tbody></table>
      </div>` : ""}

      <!-- Divider -->
      <hr class="divider" />

      <!-- Notes (optional) -->
      ${notesHTML}

      <!-- Questions -->
      ${questionsHTML}

      <!-- Answer Key — new page -->
      <div class="answer-key-page">
        <h2 class="answer-key-title">${lbl.answerKey}</h2>
        ${answerKeyHTML}
      </div>

    </body>
    </html>`;

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: form.pageSize || "A4",
      printBackground: true,
      margin: { top: "40px", bottom: "40px", left: "40px", right: "40px" },
    });

    await browser.close();
    return pdfBuffer;

  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
};