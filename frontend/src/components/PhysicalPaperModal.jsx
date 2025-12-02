import { useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import axios from "axios";
import { 
  FaUniversity, FaChalkboardTeacher, FaBook, FaCalendarAlt, 
  FaClock, FaStickyNote, FaFilePdf, FaFileWord 
} from "react-icons/fa";

const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center rounded-t-3xl">
          <h2 className="text-3xl font-extrabold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full p-3 transition">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-8 space-y-8">
          {children}
        </div>
      </div>
    </div>
  );
};

const PhysicalPaperModal = ({ isOpen, onClose, assessmentId, assessmentTitle }) => {
  const [form, setForm] = useState({
    instituteName: "",
    teacherName: "",
    subjectName: "",
    paperDate: "",
    paperTime: "",
    notes: "",
    pageSize: "A4",
    headerFontSize: 18,
    questionFontSize: 12,
    optionFontSize: 11,
    format: "pdf",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const getPageDims = (size) => {
    const dims = { A4: [595.28, 841.89], A5: [420.94, 595.28], Letter: [612, 792] };
    return dims[size] || dims.A4;
  };

  // PERFECT PDF GENERATION - HEADER FIXED
  const generatePDF = async (qList) => {
    const pdfDoc = await PDFDocument.create();
    const [w, h] = getPageDims(form.pageSize);
    let page = pdfDoc.addPage([w, h]);

    let font, bold;
    try {
      font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    } catch {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    const margin = 60;
    const lineHeight = 1.5;
    let y = h - 80;

    const wrapText = (text, font, size, maxWidth) => {
      const words = text.split(" ");
      let line = "";
      const lines = [];
      for (const word of words) {
        const test = line + word + " ";
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
          lines.push(line.trim());
          line = word + " ";
        } else line = test;
      }
      if (line) lines.push(line.trim());
      return lines;
    };

    const drawText = (text, x, y, size, fontType = font, color = rgb(0,0,0), align = "left") => {
      const f = fontType === "bold" ? bold : font;
      const maxW = w - 2 * margin;
      const lines = wrapText(text, f, size, maxW);
      let currentY = y;
      lines.forEach(line => {
        const textWidth = f.widthOfTextAtSize(line, size);
        const posX = align === "center" ? (w - textWidth) / 2 : x;
        page.drawText(line, { x: posX, y: currentY, size, font: f, color });
        currentY -= size * lineHeight;
      });
      return currentY;
    };

    // FIRST PAGE HEADER - ONLY ONCE
    if (form.instituteName) {
      y = drawText(form.instituteName, margin, y, Number(form.headerFontSize), "bold", rgb(0,0,0), "center") - 30;
    }

    let leftY = y;
    let rightY = y;

    if (form.teacherName) {
      page.drawText("Teacher:", { x: margin, y: leftY, size: 12, font: bold });
      page.drawText(form.teacherName, { x: margin + 70, y: leftY, size: 12, font });
      leftY -= 22;
    }
    if (form.subjectName) {
      page.drawText("Subject:", { x: margin, y: leftY, size: 12, font: bold });
      page.drawText(form.subjectName, { x: margin + 70, y: leftY, size: 12, font });
      leftY -= 22;
    }

    const rightX = w - margin - 200;
    if (form.paperDate) {
      page.drawText("Date:", { x: rightX, y: rightY, size: 12, font: bold });
      page.drawText(form.paperDate, { x: rightX + 50, y: rightY, size: 12, font });
      rightY -= 22;
    }
    if (form.paperTime) {
      page.drawText("Time:", { x: rightX, y: rightY, size: 12, font: bold });
      page.drawText(form.paperTime, { x: rightX + 50, y: rightY, size: 12, font });
    }

    y = Math.min(leftY, rightY) - 20;

    if (form.notes.trim()) {
      page.drawText("Notes:", { x: margin, y: y, size: 12, font: bold });
      y -= 22;
      form.notes.split("\n").filter(l => l.trim()).forEach(line => {
        y = drawText(line.trim(), margin, y, 11) - 10;
      });
    }

    page.drawLine({
      start: { x: margin, y: y - 10 },
      end: { x: w - margin, y: y - 10 },
      thickness: 2,
      color: rgb(0,0,0),
    });
    y -= 50;

    // QUESTIONS
    qList.forEach((q, i) => {
      if (y < 150) {
        page = pdfDoc.addPage([w, h]);
        y = h - 80;
        page.drawLine({ start: { x: margin, y: h - 50 }, end: { x: w - margin, y: h - 50 }, thickness: 1, color: rgb(0.7,0.7,0.7) });
        page.drawText(assessmentTitle || "Assessment Paper", { x: w/2, y: h - 40, size: 10, font, color: rgb(0.5,0.5,0.5) });
        y -= 30;
      }

      y = drawText(`Q${i + 1}. ${q.question_text}`, margin, y, Number(form.questionFontSize), "bold") - 15;

      if (q.options && Array.isArray(q.options)) {
        q.options.forEach((opt, oi) => {
          if (y < 100) {
            page = pdfDoc.addPage([w, h]);
            y = h - 80;
            page.drawLine({ start: { x: margin, y: h - 50 }, end: { x: w - margin, y: h - 50 }, thickness: 1, color: rgb(0.7,0.7,0.7) });
            y -= 30;
          }
          y = drawText(`${String.fromCharCode(65 + oi)}. ${opt}`, margin + 30, y, Number(form.optionFontSize)) - 8;
        });
      }
      y -= 20;
    });

    // ANSWER KEY
    page = pdfDoc.addPage([w, h]);
    y = h - 100;
    page.drawLine({ start: { x: margin, y: h - 50 }, end: { x: w - margin, y: h - 50 }, thickness: 1, color: rgb(0.7,0.7,0.7) });
    drawText("ANSWER KEY", margin, y, 24, "bold", rgb(0,0,0), "center");
    y -= 60;

    qList.forEach((q, i) => {
      if (y < 100) {
        page = pdfDoc.addPage([w, h]);
        y = h - 80;
        page.drawLine({ start: { x: margin, y: h - 50 }, end: { x: w - margin, y: h - 50 }, thickness: 1, color: rgb(0.7,0.7,0.7) });
        y -= 30;
      }
      y = drawText(`Q${i + 1}: ${q.correct_answer || "N/A"}`, margin, y, 14, "bold") - 25;
    });

    return new Blob([await pdfDoc.save()], { type: "application/pdf" });
  };

  const generateDOCX = async (qList) => {
    const children = [];

    if (form.instituteName) {
      children.push(new Paragraph({
        children: [new TextRun({ text: form.instituteName, bold: true, size: form.headerFontSize * 2 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      }));
    }

    const left = [];
    if (form.teacherName) left.push(`Teacher: ${form.teacherName}`);
    if (form.subjectName) left.push(`Subject: ${form.subjectName}`);
    const right = [];
    if (form.paperDate) right.push(`Date: ${form.paperDate}`);
    if (form.paperTime) right.push(`Time: ${form.paperTime}`);

    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: left[i] || "", size: 24 }),
          new TextRun({ text: " ".repeat(40), size: 24 }),
          new TextRun({ text: right[i] || "", size: 24 })
        ]
      }));
    }

    if (form.notes.trim()) {
      children.push(new Paragraph({ children: [new TextRun({ text: "Notes:", bold: true, size: 24 })] }));
      form.notes.split("\n").filter(l => l.trim()).forEach(l => {
        children.push(new Paragraph({ children: [new TextRun({ text: l.trim(), size: 22 })] }));
      });
      children.push(new Paragraph({ spacing: { after: 200 } }));
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: "_________________________________________________", size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }));

    qList.forEach((q, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Q${i + 1}. ${q.question_text}`, bold: true, size: form.questionFontSize * 2 })],
        spacing: { after: 200 }
      }));

      if (q.options && Array.isArray(q.options)) {
        q.options.forEach((opt, oi) => {
          children.push(new Paragraph({
            children: [new TextRun({ text: `${String.fromCharCode(65 + oi)}. ${opt}`, size: form.optionFontSize * 2 })],
            indent: { left: 720 }
          }));
        });
      }
      children.push(new Paragraph({ spacing: { after: 300 } }));
    });

    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      children: [new TextRun({ text: "ANSWER KEY", bold: true, size: 40 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 }
    }));

    qList.forEach((q, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Q${i + 1}: ${q.correct_answer || "N/A"}`, bold: true, size: 28 })]
      }));
    });

    const doc = new Document({ sections: [{ children }] });
    return await Packer.toBlob(doc);
  };

  const handleSubmit = async () => {
    if (!assessmentId) return toast.error("No assessment selected");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const { data } = await axios.get(`${API_URL}/taking/assessments/${assessmentId}/print`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const questions = data?.questions;
      if (!questions?.length) {
        toast.error("No questions found");
        return;
      }

      const blob = form.format === "pdf" 
        ? await generatePDF(questions)
        : await generateDOCX(questions);

      const ext = form.format === "pdf" ? "pdf" : "docx";
      saveAs(blob, `${assessmentTitle.replace(/\s+/g, "_")}_Paper.${ext}`);
      
      toast.success(`Paper generated successfully as ${form.format.toUpperCase()}!`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate paper");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Physical Paper">
      <div className="space-y-8">

        {/* Header Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <FaUniversity className="text-2xl text-blue-600" />
            <input type="text" name="instituteName" placeholder="Institute Name" value={form.instituteName} onChange={handleChange} className="w-full bg-transparent outline-none text-lg" />
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <FaChalkboardTeacher className="text-2xl text-green-600" />
            <input type="text" name="teacherName" placeholder="Teacher Name" value={form.teacherName} onChange={handleChange} className="w-full bg-transparent outline-none text-lg" />
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <FaBook className="text-2xl text-purple-600" />
            <input type="text" name="subjectName" placeholder="Subject Name" value={form.subjectName} onChange={handleChange} className="w-full bg-transparent outline-none text-lg" />
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <FaCalendarAlt className="text-2xl text-orange-600" />
            <input type="date" name="paperDate" value={form.paperDate} onChange={handleChange} className="w-full bg-transparent outline-none text-lg" />
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
            <FaClock className="text-2xl text-red-600" />
            <input type="time" name="paperTime" value={form.paperTime} onChange={handleChange} className="w-full bg-transparent outline-none text-lg" />
          </div>
          <div className="flex items-start gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200 sm:col-span-2">
            <FaStickyNote className="text-2xl text-yellow-600 mt-1" />
            <textarea name="notes" placeholder="Additional notes (optional)" rows={3} value={form.notes} onChange={handleChange} className="w-full bg-transparent outline-none text-lg resize-none" />
          </div>
        </div>

        {/* Formatting Options */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-bold mb-2">Page Size</label>
            <select name="pageSize" value={form.pageSize} onChange={handleChange} className="w-full px-5 py-4 border-2 rounded-2xl text-lg">
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Header Font</label>
            <input type="number" name="headerFontSize" min={14} max={28} value={form.headerFontSize} onChange={handleChange} className="w-full px-5 py-4 border-2 rounded-2xl text-lg" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Question Font</label>
            <input type="number" name="questionFontSize" min={10} max={18} value={form.questionFontSize} onChange={handleChange} className="w-full px-5 py-4 border-2 rounded-2xl text-lg" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2">Option Font</label>
            <input type="number" name="optionFontSize" min={9} max={14} value={form.optionFontSize} onChange={handleChange} className="w-full px-5 py-4 border-2 rounded-2xl text-lg" />
          </div>
        </div>

        {/* Format Selection */}
        <div className="flex items-center gap-6 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border-2 border-blue-200">
          {form.format === "pdf" ? 
            <FaFilePdf className="text-5xl text-red-600" /> : 
            <FaFileWord className="text-5xl text-blue-700" />
          }
          <div className="flex-1">
            <label className="block text-lg font-bold mb-3">Output Format</label>
            <select name="format" value={form.format} onChange={handleChange} className="w-full px-6 py-5 text-xl font-medium border-2 border-blue-300 rounded-2xl focus:border-blue-600">
              <option value="pdf">PDF (.pdf) - Best for printing</option>
              <option value="docx">Word (.docx) - Fully editable</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t">
          <button onClick={onClose} disabled={loading} className="px-8 py-4 border-2 border-gray-300 rounded-2xl font-bold text-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} className="px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl font-bold text-xl shadow-xl flex items-center justify-center gap-3">
            {loading ? (
              <>
                <Spinner />
                <span>Generating...</span>
              </>
            ) : (
              "Generate & Download"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PhysicalPaperModal;