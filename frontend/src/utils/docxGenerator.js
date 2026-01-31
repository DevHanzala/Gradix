// DOCX GENERATOR - Pure DOCX Logic (No React)
import { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } from "docx";

export const generateDOCX = async (questions, form) => {
  const children = [];

  // Enhanced Header
  if (form.instituteName) {
    children.push(new Paragraph({
      children: [
        new TextRun({
          text: form.instituteName.toUpperCase(),
          size: form.headerFontSize * 2,
          bold: true,
          color: "1a1a66"
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
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
  const left = [];
  if (form.teacherName) left.push(`Teacher: ${form.teacherName}`);
  if (form.subjectName) left.push(`Subject: ${form.subjectName}`);

  const right = [];
  if (form.paperDate) right.push(`Date: ${form.paperDate}`);
  if (form.paperTime) right.push(`Time: ${form.paperTime}`);

  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const leftText = left[i] || "";
    const rightText = right[i] || "";

    children.push(new Paragraph({
      children: [
        new TextRun({ text: leftText, size: 22, bold: leftText.includes(":") }),
        new TextRun({ text: "          ", size: 22 }),
        new TextRun({ text: rightText, size: 22, bold: rightText.includes(":") }),
      ],
      spacing: { after: 150 }
    }));
  }

  // Notes section
  if (form.notes.trim()) {
    children.push(new Paragraph({
      children: [new TextRun({ text: "Instructions:", size: 24, bold: true, color: "333333" })],
      spacing: { before: 200, after: 100 }
    }));

    form.notes.split("\n").forEach(l => {
      if (l.trim()) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `• ${l.trim()}`, size: 22, color: "555555" })],
          spacing: { after: 100 }
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

  // Questions
  questions.forEach((q, i) => {
    children.push(new Paragraph({
      children: [new TextRun({
        text: `Q${i + 1}. ${q.question_text}`,
        size: form.questionFontSize * 2,
        bold: true,
        color: "1a1a1a"
      })],
      spacing: { before: 200, after: 150 }
    }));

    if (q.options) {
      q.options.forEach((opt, oi) =>
        children.push(new Paragraph({
          children: [new TextRun({
            text: `${String.fromCharCode(9675)} ${String.fromCharCode(65 + oi)}. ${opt}`,
            size: form.optionFontSize * 2,
            color: "333333"
          })],
          indent: { left: 720 },
          spacing: { after: 100 }
        }))
      );
    }

    children.push(new Paragraph({ spacing: { after: 250 } }));
  });

  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Answer Key
  children.push(new Paragraph({
    children: [new TextRun({ text: "ANSWER KEY", size: 40, bold: true, color: "1a1a66" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 }
  }));

  questions.forEach((q, i) =>
    children.push(new Paragraph({
      children: [new TextRun({
        text: `Q${i + 1}: ${q.correct_answer || "N/A"}`,
        size: 26,
        bold: true,
        color: "333333"
      })],
      spacing: { after: 150 }
    }))
  );

  const doc = new Document({ sections: [{ children }] });
  return await Packer.toBlob(doc);
};