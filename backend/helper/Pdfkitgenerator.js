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
        "--font-render-hinting=medium"
      ]
    });

    const page = await browser.newPage();

    // Load local Arabic font
    const fontPath = path.join(process.cwd(), "fonts/NotoSansArabic-Regular.ttf");
    const fontData = fs.readFileSync(fontPath).toString("base64");

    const html = `
    <!DOCTYPE html>
    <html lang="${language}" dir="${isRTL ? "rtl" : "ltr"}">
    <head>
      <meta charset="UTF-8" />
      <style>
        @font-face {
          font-family: 'NotoSansArabic';
          src: url(data:font/ttf;base64,${fontData}) format('truetype');
        }

        body {
          font-family: ${
            isRTL ? "'NotoSansArabic'" : "Arial, Helvetica, sans-serif"
          };
          padding: 40px;
          direction: ${isRTL ? "rtl" : "ltr"};
          font-size: 14px;
        }

        h1 {
          text-align: center;
          margin-bottom: 20px;
        }

        .info {
          margin-bottom: 20px;
        }

        .question {
          margin-bottom: 18px;
        }

        .options {
          margin-top: 6px;
          padding-${isRTL ? "right" : "left"}: 20px;
        }

        .answer-key {
          page-break-before: always;
          margin-top: 40px;
        }

      </style>
    </head>

    <body>

      <h1>${headers.instituteName}</h1>

      <div class="info">
        <div>${headers.teacherName}</div>
        <div>${headers.subjectName}</div>
        <div>${headers.paperDate}</div>
        <div>${headers.paperTime}</div>
      </div>

      ${questions
        .map(
          (q, i) => `
        <div class="question">
          <strong>${i + 1}. ${q.question_text}</strong>
          <div class="options">
            ${q.options
              .map((opt) => `<div>${opt}</div>`)
              .join("")}
          </div>
        </div>
      `
        )
        .join("")}

      <div class="answer-key">
        <h2>Answer Key</h2>
        ${questions
          .map(
            (q, i) =>
              `<div>${i + 1}: ${q.correct_answer || "N/A"}</div>`
          )
          .join("")}
      </div>

    </body>
    </html>
    `;

    await page.setContent(html, {
      waitUntil: "networkidle0"
    });

    const pdfBuffer = await page.pdf({
      format: form.pageSize || "A4",
      printBackground: true,
      margin: {
        top: "40px",
        bottom: "40px",
        left: "40px",
        right: "40px"
      }
    });

    await browser.close();

    return pdfBuffer;
  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
};
