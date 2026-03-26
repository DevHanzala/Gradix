// DOCX GENERATOR - Fixed with Proper RTL and Language Support
import { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } from "docx";

export const generateDOCX = async (questions, form, isRTL = false, language = 'en') => {
  
  const children = [];

  // Language-specific labels
  const labels = {
    en: { teacher: 'Teacher', subject: 'Subject', date: 'Date', time: 'Time', instructions: 'Instructions', answerKey: 'ANSWER KEY' },
    ur: { teacher: 'استاد', subject: 'مضمون', date: 'تاریخ', time: 'وقت', instructions: 'ہدایات', answerKey: 'جوابات کی کلید' },
    ar: { teacher: 'المعلم', subject: 'المادة', date: 'التاريخ', time: 'الوقت', instructions: 'التعليمات', answerKey: 'مفتاح الإجابات' },
    fa: { teacher: 'معلم', subject: 'درس', date: 'تاریخ', time: 'زمان', instructions: 'دستورالعمل', answerKey: 'کلید پاسخ' },
  };

  const t = labels[language] || labels.en;

  // Enhanced Header
  if (form.instituteName) {
    children.push(new Paragraph({
      children: [
        new TextRun({
          text: form.instituteName.toUpperCase(),
          size: form.headerFontSize * 2,
          bold: true,
          color: "1a1a66",
          rightToLeft: isRTL
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      bidirectional: isRTL
    }));

    children.push(new Paragraph({
      children: [
        new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━", size: 20, color: "333366" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    }));
  }

  // Information section
  const leftItems = [];
  if (form.teacherName) leftItems.push(`${t.teacher}: ${form.teacherName}`);
  if (form.subjectName) leftItems.push(`${t.subject}: ${form.subjectName}`);

  const rightItems = [];
  if (form.paperDate) rightItems.push(`${t.date}: ${form.paperDate}`);
  if (form.paperTime) rightItems.push(`${t.time}: ${form.paperTime}`);

  for (let i = 0; i < Math.max(leftItems.length, rightItems.length); i++) {
    const leftText = leftItems[i] || "";
    const rightText = rightItems[i] || "";

    if (isRTL) {
      // For RTL, put items on same line but right-aligned
      children.push(new Paragraph({
        children: [
          new TextRun({ text: rightText, size: 22, bold: rightText.includes(":"), rightToLeft: true }),
          new TextRun({ text: "          ", size: 22 }),
          new TextRun({ text: leftText, size: 22, bold: leftText.includes(":"), rightToLeft: true }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 150 },
        bidirectional: true
      }));
    } else {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: leftText, size: 22, bold: leftText.includes(":") }),
          new TextRun({ text: "          ", size: 22 }),
          new TextRun({ text: rightText, size: 22, bold: rightText.includes(":") }),
        ],
        spacing: { after: 150 }
      }));
    }
  }

  // Notes section
  if (form.notes && form.notes.trim()) {
    children.push(new Paragraph({
      children: [new TextRun({ 
        text: `${t.instructions}:`, 
        size: 24, 
        bold: true, 
        color: "333333",
        rightToLeft: isRTL 
      })],
      alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: 200, after: 100 },
      bidirectional: isRTL
    }));

    form.notes.split("\n").forEach(line => {
      if (line.trim()) {
        children.push(new Paragraph({
          children: [new TextRun({ 
            text: `• ${line.trim()}`, 
            size: 22, 
            color: "555555",
            rightToLeft: isRTL 
          })],
          alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 100 },
          bidirectional: isRTL
        }));
      }
    });

    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  children.push(new Paragraph({
    children: [
      new TextRun({ 
        text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 
        size: 20, 
        color: "000000" 
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 }
  }));

  // Language-specific question prefix
  const qPrefix = {
    en: 'Q',
    ur: 'سوال',
    ar: 'س',
    fa: 'سوال'
  };
  const questionPrefix = qPrefix[language] || 'Q';

  // Questions
  questions.forEach((q, i) => {
    children.push(new Paragraph({
      children: [new TextRun({
        text: `${questionPrefix}${i + 1}. ${q.question_text}`,
        size: form.questionFontSize * 2,
        bold: true,
        color: "1a1a1a",
        rightToLeft: isRTL
      })],
      alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: 200, after: 150 },
      bidirectional: isRTL
    }));

    if (q.options && Array.isArray(q.options)) {
      q.options.forEach((opt, oi) => {
        const optLabel = String.fromCharCode(65 + oi);
        children.push(new Paragraph({
          children: [new TextRun({
            text: `${String.fromCharCode(9675)} ${optLabel}. ${opt}`,
            size: form.optionFontSize * 2,
            color: "333333",
            rightToLeft: isRTL
          })],
          indent: { left: 720 },
          alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 100 },
          bidirectional: isRTL
        }));
      });
    }

    children.push(new Paragraph({ spacing: { after: 250 } }));
  });

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Answer Key
  children.push(new Paragraph({
    children: [new TextRun({ 
      text: t.answerKey, 
      size: 40, 
      bold: true, 
      color: "1a1a66",
      rightToLeft: isRTL 
    })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    bidirectional: isRTL
  }));

  questions.forEach((q, i) => {
    let answerValue = q.correct_answer;
    
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
    
    children.push(new Paragraph({
      children: [new TextRun({
        text: `${questionPrefix}${i + 1}: ${answerValue || "N/A"}`,
        size: 26,
        bold: true,
        color: "333333",
        rightToLeft: isRTL
      })],
      alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { after: 150 },
      bidirectional: isRTL
    }));
  });

  console.log(`[DOCX] Creating document with ${children.length} paragraphs...`);
  
  const doc = new Document({ sections: [{ children }] });
  
  return await Packer.toBlob(doc);
};