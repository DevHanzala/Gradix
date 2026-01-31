// PDF GENERATOR - Pure PDF Logic (No React)
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import * as fontkit from 'fontkit';
import { getPageDimensions, wrapText } from './paperUtils.js';

export const drawWatermark = (page, font, width, height) => {
  const wmText = "Gradewise-AI";
  const wmSize = Math.min(width, height) / 8;
  const textWidth = font.widthOfTextAtSize(wmText, wmSize);
  const textHeight = wmSize;

  const centerX = width / 2;
  const centerY = height / 2;

  page.drawText(wmText, {
    x: centerX - textWidth / 2,
    y: centerY - textHeight / 2,
    size: wmSize,
    font,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(-45),
    opacity: 0.16,
  });
};

export const loadFonts = async (pdfDoc, isRTL) => {
  pdfDoc.registerFontkit(fontkit);

  let font, boldFont;

  if (isRTL) {
    try {
      const regularBytes = await fetch('/fonts/NotoSansArabic-Regular.ttf').then(res => res.arrayBuffer());
      const boldBytes = await fetch('/fonts/NotoSansArabic-Bold.ttf')
        .then(res => res.arrayBuffer())
        .catch(() => regularBytes);

      font = await pdfDoc.embedFont(regularBytes);
      boldFont = await pdfDoc.embedFont(boldBytes);

      console.log("✅ RTL font loaded");
    } catch (err) {
      console.error("Custom font failed:", err);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  return { font, boldFont };
};

export const drawText = (page, text, x, y, width, font, boldFont, fontSize, isRTL, isBold = false, color = rgb(0, 0, 0), align = "left") => {
  const selectedFont = isBold ? boldFont : font;
  const margin = 60;
  const maxW = width - 2 * margin;
  const lines = wrapText(text, selectedFont, fontSize, maxW, isRTL);
  let currentY = y;
  const lineHeight = 1.5;

  lines.forEach(line => {
    const textWidth = selectedFont.widthOfTextAtSize(line, fontSize);
    let posX = align === "center" ? (width - textWidth) / 2 : x;
    if (isRTL && align !== "center") posX = width - margin - textWidth;

    page.drawText(line, { x: posX, y: currentY, size: fontSize, font: selectedFont, color });
    currentY -= fontSize * lineHeight;
  });

  return currentY;
};

export const drawHeader = (page, form, width, height, font, boldFont, isRTL) => {
  const margin = 60;
  let y = height - 50;

  // Institute name
  if (form.instituteName) {
    y = drawText(page, form.instituteName.toUpperCase(), margin, y, width, font, boldFont, Number(form.headerFontSize), isRTL, true, rgb(0.1, 0.1, 0.4), "center");
    y -= 20;
  }

  // Information grid
  const leftX = margin;
  const rightX = width / 2 + 40;
  let leftY = y;
  let rightY = y;

  if (form.teacherName) {
    page.drawText("Teacher:", { x: leftX, y: leftY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(form.teacherName, { x: leftX + 70, y: leftY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    leftY -= 20;
  }

  if (form.subjectName) {
    page.drawText("Subject:", { x: leftX, y: leftY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(form.subjectName, { x: leftX + 70, y: leftY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    leftY -= 20;
  }

  if (form.paperDate) {
    page.drawText("Date:", { x: rightX, y: rightY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(form.paperDate, { x: rightX + 50, y: rightY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    rightY -= 20;
  }

  if (form.paperTime) {
    page.drawText("Time:", { x: rightX, y: rightY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(form.paperTime, { x: rightX + 50, y: rightY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    rightY -= 20;
  }

  y = Math.min(leftY, rightY) - 10;

  // Notes section
  if (form.notes.trim()) {
    const notesBoxY = y;
    page.drawRectangle({
      x: margin,
      y: notesBoxY - 60,
      width: width - 2 * margin,
      height: 60,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 0.98),
    });

    page.drawText("Instructions:", { x: margin + 10, y: notesBoxY - 15, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    let notesY = notesBoxY - 30;
    form.notes.split("\n").forEach(line => {
      if (line.trim()) {
        page.drawText(line.trim(), { x: margin + 10, y: notesY, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
        notesY -= 12;
      }
    });
    y = notesBoxY - 50;
  }

  y -= 15;

  // Separator lines
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: width - margin, y: y },
    thickness: 1.5,
    color: rgb(0, 0, 0),
  });

  page.drawLine({
    start: { x: margin, y: y - 3 },
    end: { x: width - margin, y: y - 3 },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  });

  return y - 30;
};

export const generatePDF = async (questions, form, isRTL) => {
  const pdfDoc = await PDFDocument.create();
  const [width, height] = getPageDimensions(form.pageSize);

  const { font, boldFont } = await loadFonts(pdfDoc, isRTL);

  let page = pdfDoc.addPage([width, height]);
  drawWatermark(page, font, width, height);

  const margin = 60;
  let y = await drawHeader(page, form, width, height, font, boldFont, isRTL);

  // Draw questions
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    if (y < 120) {
      page = pdfDoc.addPage([width, height]);
      drawWatermark(page, font, width, height);
      y = height - 60;
    }

    const qNumText = `Q${i + 1}.`;
    y = drawText(page, `${qNumText} ${q.question_text}`, margin, y, width, font, boldFont, Number(form.questionFontSize), isRTL, true, rgb(0.1, 0.1, 0.1)) - 12;

    if (q.options) {
      for (let oi = 0; oi < q.options.length; oi++) {
        if (y < 100) {
          page = pdfDoc.addPage([width, height]);
          drawWatermark(page, font, width, height);
          y = height - 40;
        }

        const optLabel = String.fromCharCode(65 + oi);
        page.drawCircle({
          x: margin + 36,
          y: y - Number(form.optionFontSize) / 2 + 2,
          size: 8,
          borderColor: rgb(0.4, 0.4, 0.4),
          borderWidth: 1,
        });

        page.drawText(optLabel, {
          x: margin + 33,
          y: y - Number(form.optionFontSize) / 2 - 1,
          size: 9,
          font: boldFont,
          color: rgb(0.3, 0.3, 0.3),
        });

        y = drawText(page, q.options[oi], margin + 52, y, width, font, boldFont, Number(form.optionFontSize), isRTL, false, rgb(0.2, 0.2, 0.2)) - 8;
      }
    }

    y -= 18;
  }

  // Answer key page
  page = pdfDoc.addPage([width, height]);
  drawWatermark(page, font, width, height);

  let ay = height - 80;
  ay = drawText(page, "ANSWER KEY", margin, ay, width, font, boldFont, 24, isRTL, true, rgb(0.1, 0.1, 0.4), "center") - 40;

  questions.forEach((q, i) => {
    if (ay < 100) {
      page = pdfDoc.addPage([width, height]);
      drawWatermark(page, font, width, height);
      ay = height - 80;
    }

    const answerText = `Q${i + 1}: ${q.correct_answer || "N/A"}`;
    ay = drawText(page, answerText, margin, ay, width, font, boldFont, 12, isRTL, true, rgb(0.2, 0.2, 0.2)) - 18;
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
};