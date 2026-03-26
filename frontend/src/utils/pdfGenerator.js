// PDF GENERATOR - Fixed with Proper Font Support for All Languages
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
      // Try multiple font sources
      const fontUrls = [
        '/fonts/NotoSansArabic-Regular.ttf',
        'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf',
        'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansarabic/NotoSansArabic-Regular.ttf'
      ];

      const boldFontUrls = [
        '/fonts/NotoSansArabic-Bold.ttf',
        'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Bold.ttf',
        'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansarabic/NotoSansArabic-Bold.ttf'
      ];

      let regularBytes = null;
      let boldBytes = null;

      // Try loading regular font
      for (const url of fontUrls) {
        try {
          console.log(`[PDF] Trying font URL: ${url}`);
          regularBytes = await fetch(url).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
          });
          break;
        } catch (err) {
          console.log(`[PDF] ⚠️ Failed to load from ${url}: ${err.message}`);
        }
      }

      // Try loading bold font
      for (const url of boldFontUrls) {
        try {
          boldBytes = await fetch(url).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
          });
          break;
        } catch (err) {
          console.log(`[PDF] ⚠️ Failed to load bold from ${url}: ${err.message}`);
        }
      }

      // If we got at least regular font, use it
      if (regularBytes) {
        font = await pdfDoc.embedFont(regularBytes);
        boldFont = boldBytes ? await pdfDoc.embedFont(boldBytes) : font;
        return { font, boldFont };
      }

      throw new Error("Could not load any RTL font");

    } catch (err) {
      console.error(`[PDF] ❌ RTL font loading failed:`, err.message);
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  return { font, boldFont };
};

// Helper to reverse text for RTL languages
const reverseText = (text, isRTL) => {
  if (!isRTL) return text;
  
  // Split by words, reverse array, join back
  // This helps with RTL rendering
  const words = text.split(' ');
  return words.reverse().join(' ');
};

export const drawText = (page, text, x, y, width, font, boldFont, fontSize, isRTL, isBold = false, color = rgb(0, 0, 0), align = "left") => {
  const selectedFont = isBold ? boldFont : font;
  const margin = 60;
  const maxW = width - 2 * margin;
  
  // For RTL text, we need special handling
  let processedText = text;
  if (isRTL) {
    // Reverse the text for proper RTL display
    processedText = reverseText(text, true);
  }
  
  const lines = wrapText(processedText, selectedFont, fontSize, maxW, isRTL);
  let currentY = y;
  const lineHeight = 1.5;

  lines.forEach(line => {
    const textWidth = selectedFont.widthOfTextAtSize(line, fontSize);
    let posX = align === "center" ? (width - textWidth) / 2 : x;
    
    if (isRTL && align !== "center") {
      // For RTL, position from right side
      posX = width - margin - textWidth;
    }

    page.drawText(line, { 
      x: posX, 
      y: currentY, 
      size: fontSize, 
      font: selectedFont, 
      color 
    });
    
    currentY -= fontSize * lineHeight;
  });

  return currentY;
};

export const drawHeader = (page, form, width, height, font, boldFont, isRTL, language) => {
  const margin = 60;
  let y = height - 50;

  // Language-specific labels for header fields
  const labels = {
    en: { teacher: 'Teacher', subject: 'Subject', date: 'Date', time: 'Time', instructions: 'Instructions' },
    ur: { teacher: 'استاد', subject: 'مضمون', date: 'تاریخ', time: 'وقت', instructions: 'ہدایات' },
    ar: { teacher: 'المعلم', subject: 'المادة', date: 'التاريخ', time: 'الوقت', instructions: 'التعليمات' },
    fa: { teacher: 'معلم', subject: 'درس', date: 'تاریخ', time: 'زمان', instructions: 'دستورالعمل' },
  };

  const t = labels[language] || labels.en;

  // Institute name (centered)
  if (form.instituteName) {
    const instituteText = isRTL ? reverseText(form.instituteName.toUpperCase(), true) : form.instituteName.toUpperCase();
    y = drawText(page, instituteText, margin, y, width, font, boldFont, Number(form.headerFontSize), isRTL, true, rgb(0.1, 0.1, 0.4), "center");
    y -= 20;
  }

  // Information grid
  const leftX = isRTL ? width / 2 + 40 : margin;
  const rightX = isRTL ? margin : width / 2 + 40;
  let leftY = y;
  let rightY = y;

  if (form.teacherName) {
    const labelText = isRTL ? reverseText(t.teacher + ':', true) : t.teacher + ':';
    const valueText = isRTL ? reverseText(form.teacherName, true) : form.teacherName;
    
    page.drawText(labelText, { x: leftX, y: leftY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(valueText, { x: leftX + (isRTL ? 50 : 70), y: leftY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    leftY -= 20;
  }

  if (form.subjectName) {
    const labelText = isRTL ? reverseText(t.subject + ':', true) : t.subject + ':';
    const valueText = isRTL ? reverseText(form.subjectName, true) : form.subjectName;
    
    page.drawText(labelText, { x: leftX, y: leftY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(valueText, { x: leftX + (isRTL ? 50 : 70), y: leftY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    leftY -= 20;
  }

  if (form.paperDate) {
    const labelText = isRTL ? reverseText(t.date + ':', true) : t.date + ':';
    
    page.drawText(labelText, { x: rightX, y: rightY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(form.paperDate, { x: rightX + 50, y: rightY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    rightY -= 20;
  }

  if (form.paperTime) {
    const labelText = isRTL ? reverseText(t.time + ':', true) : t.time + ':';
    
    page.drawText(labelText, { x: rightX, y: rightY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(form.paperTime, { x: rightX + 50, y: rightY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
    rightY -= 20;
  }

  y = Math.min(leftY, rightY) - 10;

  // Notes section
  if (form.notes && form.notes.trim()) {
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

    const instructionsText = isRTL ? reverseText(t.instructions + ':', true) : t.instructions + ':';
    page.drawText(instructionsText, { x: margin + 10, y: notesBoxY - 15, size: 10, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
    
    let notesY = notesBoxY - 30;
    form.notes.split("\n").forEach(line => {
      if (line.trim()) {
        const noteText = isRTL ? reverseText(line.trim(), true) : line.trim();
        page.drawText(noteText, { x: margin + 10, y: notesY, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
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

export const generatePDF = async (questions, form, isRTL, language = 'en') => {
  
  const pdfDoc = await PDFDocument.create();
  const [width, height] = getPageDimensions(form.pageSize);

  const { font, boldFont } = await loadFonts(pdfDoc, isRTL);

  let page = pdfDoc.addPage([width, height]);
  drawWatermark(page, font, width, height);

  const margin = 60;
  let y = await drawHeader(page, form, width, height, font, boldFont, isRTL, language);

  // Language-specific question prefix
  const qPrefix = {
    en: 'Q',
    ur: 'سوال',
    ar: 'س',
    fa: 'سوال'
  };
  const questionPrefix = qPrefix[language] || 'Q';

  // Draw questions
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    if (y < 120) {
      page = pdfDoc.addPage([width, height]);
      drawWatermark(page, font, width, height);
      y = height - 60;
    }

    const qNumText = `${questionPrefix}${i + 1}.`;
    const qText = isRTL ? reverseText(q.question_text, true) : q.question_text;
    y = drawText(page, `${qNumText} ${qText}`, margin, y, width, font, boldFont, Number(form.questionFontSize), isRTL, true, rgb(0.1, 0.1, 0.1)) - 12;

    if (q.options && Array.isArray(q.options)) {
      for (let oi = 0; oi < q.options.length; oi++) {
        if (y < 100) {
          page = pdfDoc.addPage([width, height]);
          drawWatermark(page, font, width, height);
          y = height - 40;
        }

        const optLabel = String.fromCharCode(65 + oi);
        const circleX = isRTL ? width - margin - 36 : margin + 36;
        
        page.drawCircle({
          x: circleX,
          y: y - Number(form.optionFontSize) / 2 + 2,
          size: 8,
          borderColor: rgb(0.4, 0.4, 0.4),
          borderWidth: 1,
        });

        page.drawText(optLabel, {
          x: circleX - 3,
          y: y - Number(form.optionFontSize) / 2 - 1,
          size: 9,
          font: boldFont,
          color: rgb(0.3, 0.3, 0.3),
        });

        const optText = isRTL ? reverseText(q.options[oi], true) : q.options[oi];
        const textX = isRTL ? width - margin - 52 : margin + 52;
        y = drawText(page, optText, textX, y, width, font, boldFont, Number(form.optionFontSize), isRTL, false, rgb(0.2, 0.2, 0.2)) - 8;
      }
    }

    y -= 18;
  }

  // Answer key page
  page = pdfDoc.addPage([width, height]);
  drawWatermark(page, font, width, height);

  let ay = height - 80;
  
  // Language-specific "ANSWER KEY" text
  const answerKeyText = {
    en: 'ANSWER KEY',
    ur: 'جوابات کی کلید',
    ar: 'مفتاح الإجابات',
    fa: 'کلید پاسخ'
  };
  const headerText = answerKeyText[language] || 'ANSWER KEY';
  const headerDisplay = isRTL ? reverseText(headerText, true) : headerText;
  
  ay = drawText(page, headerDisplay, margin, ay, width, font, boldFont, 24, isRTL, true, rgb(0.1, 0.1, 0.4), "center") - 40;

  questions.forEach((q, i) => {
    if (ay < 100) {
      page = pdfDoc.addPage([width, height]);
      drawWatermark(page, font, width, height);
      ay = height - 80;
    }

    let answerValue = q.correct_answer || "N/A";
    
    // Handle boolean answers
    if (typeof answerValue === 'boolean') {
      const boolText = {
        en: answerValue ? 'True' : 'False',
        ur: answerValue ? 'صحیح' : 'غلط',
        ar: answerValue ? 'صحيح' : 'خطأ',
        fa: answerValue ? 'درست' : 'نادرست'
      };
      answerValue = boolText[language] || (answerValue ? 'True' : 'False');
    }
    
    const ansDisplay = isRTL ? reverseText(String(answerValue), true) : String(answerValue);
    const answerText = `${questionPrefix}${i + 1}: ${ansDisplay}`;
    ay = drawText(page, answerText, margin, ay, width, font, boldFont, 12, isRTL, true, rgb(0.2, 0.2, 0.2)) - 18;
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
};