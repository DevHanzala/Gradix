import { useState } from "react";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import axios from "axios";
import {
  FaUniversity,
  FaChalkboardTeacher,
  FaBook,
  FaCalendarAlt,
  FaClock,
  FaStickyNote,
  FaFilePdf,
  FaFileWord,
  FaDownload,
  FaTimes,
  FaWrench,
} from "react-icons/fa";

const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const PhysicalPaperModal = ({ isOpen, onClose, assessmentId, assessmentTitle }) => {
  const [form, setForm] = useState({
    instituteName: "",
    teacherName: "",
    subjectName: "",
    paperDate: "",
    paperTime: "",
    notes: "",
    pageSize: "A4",
    headerFontSize: 26, // increased prominence default
    questionFontSize: 13,
    optionFontSize: 12,
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

  // Watermark utility
  const drawWatermarkOnPage = (page, font, w, h) => {
    const wmText = "Gradewise-AI";
    const wmSize = Math.min(w, h) / 6;

    page.drawText(wmText, {
      x: w / 6,
      y: h / 2,
      size: wmSize,
      font,
      color: rgb(0.7, 0.7, 0.7),
      rotate: degrees(-45),
      opacity: 0.12,
    });
  };

  // PDF GENERATION (updated with header divider + prominent institute)
  const generatePDF = async (qList) => {
    const pdfDoc = await PDFDocument.create();
    const [w, h] = getPageDims(form.pageSize);

    let page = pdfDoc.addPage([w, h]);

    let font, boldFont;
    try {
      font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    } catch {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    drawWatermarkOnPage(page, font, w, h);

    const margin = 50;
    const lineHeight = 1.4;
    let y = h - 60;

    const wrapText = (text, f, size, maxWidth) => {
      const words = text.split(" ");
      let line = "";
      const lines = [];
      for (const word of words) {
        const test = line + word + " ";
        if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
          lines.push(line.trim());
          line = word + " ";
        } else {
          line = test;
        }
      }
      if (line) lines.push(line.trim());
      return lines;
    };

    const drawText = (text, x, yStart, size, fontType = font, color = rgb(0, 0, 0), align = "left") => {
      const f = fontType === "bold" ? boldFont : fontType;
      const maxW = w - 2 * margin;
      const lines = wrapText(text, f, size, maxW);
      let currentY = yStart;

      lines.forEach(line => {
        const textWidth = f.widthOfTextAtSize(line, size);
        const posX = align === "center" ? (w - textWidth) / 2 : x;
        page.drawText(line, { x: posX, y: currentY, size, font: f, color });
        currentY -= size * lineHeight;
      });

      return currentY;
    };

    // Institute Name (larger + more prominent)
    if (form.instituteName) {
      y = drawText(form.instituteName, margin, y, Number(form.headerFontSize) + 6, "bold", rgb(0, 0, 0), "center") - 14;
    }

    // Header Info Left/Right
    let leftY = y;
    let rightY = y;

    if (form.teacherName) {
      page.drawText("Teacher:", { x: margin, y: leftY, size: 12, font: boldFont });
      page.drawText(form.teacherName, { x: margin + 80, y: leftY, size: 12, font });
      leftY -= 18;
    }
    if (form.subjectName) {
      page.drawText("Subject:", { x: margin, y: leftY, size: 12, font: boldFont });
      page.drawText(form.subjectName, { x: margin + 80, y: leftY, size: 12, font });
      leftY -= 18;
    }

    const rightX = w - margin - 200;

    if (form.paperDate) {
      page.drawText("Date:", { x: rightX, y: rightY, size: 12, font: boldFont });
      page.drawText(form.paperDate, { x: rightX + 60, y: rightY, size: 12, font });
      rightY -= 18;
    }
    if (form.paperTime) {
      page.drawText("Time:", { x: rightX, y: rightY, size: 12, font: boldFont });
      page.drawText(form.paperTime, { x: rightX + 60, y: rightY, size: 12, font });
    }

    y = Math.min(leftY, rightY) - 10;

    // Notes
    if (form.notes.trim()) {
      page.drawText("Notes:", { x: margin, y, size: 12, font: boldFont });
      y -= 18;
      form.notes.split("\n").forEach(line => {
        y = drawText(line.trim(), margin, y, 11, font) - 8;
      });
    }

    y -= 12;

    // **HEADER DIVIDER** (Option B)
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: w - margin, y: y },
      thickness: 1.2,
      color: rgb(0, 0, 0),
    });

    y -= 25;

    // QUESTIONS
    for (let i = 0; i < qList.length; i++) {
      const q = qList[i];

      if (y < 140) {
        page = pdfDoc.addPage([w, h]);
        drawWatermarkOnPage(page, font, w, h);
        y = h - 70;
      }

      y = drawText(`Q${i + 1}. ${q.question_text}`, margin, y, Number(form.questionFontSize), "bold") - 8;

      if (q.options) {
        for (let oi = 0; oi < q.options.length; oi++) {
          if (y < 100) {
            page = pdfDoc.addPage([w, h]);
            drawWatermarkOnPage(page, font, w, h);
            y = h - 70;
          }
          y = drawText(`${String.fromCharCode(65 + oi)}. ${q.options[oi]}`, margin + 28, y, Number(form.optionFontSize), font) - 6;
        }
      }

      y -= 12;
    }

    // ANSWER KEY (not bold)
    page = pdfDoc.addPage([w, h]);
    drawWatermarkOnPage(page, font, w, h);

    let ay = h - 80;
    ay = drawText("ANSWER KEY", margin, ay, 20, boldFont, rgb(0, 0, 0), "center") - 20;

    qList.forEach((q, i) => {
      if (ay < 100) {
        page = pdfDoc.addPage([w, h]);
        drawWatermarkOnPage(page, font, w, h);
        ay = h - 80;
      }
      ay = drawText(`Q${i + 1}: ${q.correct_answer || "N/A"}`, margin, ay, 12, font) - 10;
    });

    return new Blob([await pdfDoc.save()], { type: "application/pdf" });
  };

  // DOCX GENERATION (unchanged except icons)
  const generateDOCX = async (qList) => {
    const children = [];

    if (form.instituteName) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `🎓 ${form.instituteName}`, size: form.headerFontSize * 2, bold: true }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      }));
    }

    const left = [];
    if (form.teacherName) left.push(`🧑‍🏫 Teacher: ${form.teacherName}`);
    if (form.subjectName) left.push(`📚 Subject: ${form.subjectName}`);

    const right = [];
    if (form.paperDate) right.push(`📅 Date: ${form.paperDate}`);
    if (form.paperTime) right.push(`⏰ Time: ${form.paperTime}`);

    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: left[i] || "", size: 24 }),
          new TextRun({ text: "     ", size: 24 }),
          new TextRun({ text: right[i] || "", size: 24 }),
        ],
      }));
    }

    if (form.notes.trim()) {
      children.push(new Paragraph({ children: [new TextRun({ text: "📝 Notes:", size: 24, bold: true })] }));
      form.notes.split("\n").forEach(l =>
        children.push(new Paragraph({ children: [new TextRun({ text: l, size: 22 })] }))
      );
      children.push(new Paragraph({ spacing: { after: 200 } }));
    }

    children.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 200 } }));

    qList.forEach((q, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Q${i + 1}. ${q.question_text}`, size: form.questionFontSize * 2, bold: true })],
        spacing: { after: 200 }
      }));

      q.options &&
        q.options.forEach((opt, oi) =>
          children.push(new Paragraph({
            children: [new TextRun({ text: `${String.fromCharCode(65 + oi)}. ${opt}`, size: form.optionFontSize * 2 })],
            indent: { left: 720 },
          }))
        );

      children.push(new Paragraph({ spacing: { after: 200 } }));
    });

    children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(new Paragraph({
      children: [new TextRun({ text: "ANSWER KEY", size: 36, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    }));

    qList.forEach((q, i) =>
      children.push(new Paragraph({
        children: [new TextRun({ text: `Q${i + 1}: ${q.correct_answer || "N/A"}`, size: 28 })],
      }))
    );

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

      if (!data?.questions?.length) {
        toast.error("No questions found");
        setLoading(false);
        return;
      }

      const blob = form.format === "pdf"
        ? await generatePDF(data.questions)
        : await generateDOCX(data.questions);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full h-full overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-5 rounded-t-3xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FaFilePdf className="text-3xl" />
            <div>
              <h2 className="text-2xl font-bold">Generate Paper</h2>
              <p className="text-indigo-100 text-sm">{assessmentTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full p-2 transition">
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Inputs */}
          <div className="space-y-3">
            <div className="flex items-center gap-4 bg-blue-50 p-3 rounded border border-blue-200">
              <FaUniversity className="text-2xl text-blue-700" />
              <input type="text" name="instituteName" placeholder="Institute Name" value={form.instituteName} onChange={handleChange} className="w-full bg-transparent outline-none text-base" />
            </div>
            <div className="flex items-center gap-4 bg-green-50 p-3 rounded border border-green-200">
              <FaChalkboardTeacher className="text-2xl text-green-700" />
              <input type="text" name="teacherName" placeholder="Teacher Name" value={form.teacherName} onChange={handleChange} className="w-full bg-transparent outline-none text-base" />
            </div>
            <div className="flex items-center gap-4 bg-purple-50 p-3 rounded border border-purple-200">
              <FaBook className="text-2xl text-purple-700" />
              <input type="text" name="subjectName" placeholder="Subject Name" value={form.subjectName} onChange={handleChange} className="w-full bg-transparent outline-none text-base" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-4 bg-orange-50 p-3 rounded border border-orange-200">
                <FaCalendarAlt className="text-2xl text-orange-700" />
                <input type="date" name="paperDate" value={form.paperDate} onChange={handleChange} className="w-full bg-transparent outline-none text-base" />
              </div>
              <div className="flex items-center gap-4 bg-red-50 p-3 rounded border border-red-200">
                <FaClock className="text-2xl text-red-700" />
                <input type="time" name="paperTime" value={form.paperTime} onChange={handleChange} className="w-full bg-transparent outline-none text-base" />
              </div>
            </div>

            <div className="flex items-start gap-4 bg-yellow-50 p-3 rounded border border-yellow-200">
              <FaStickyNote className="text-2xl text-yellow-700 mt-1" />
              <textarea name="notes" rows={3} value={form.notes} onChange={handleChange} placeholder="Additional notes (optional)" className="w-full bg-transparent outline-none text-base resize-none" />
            </div>
          </div>

          {/* Formatting */}
          <div className="bg-gray-50 p-4 border-2 rounded-xl">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
              <FaWrench className="text-indigo-600" /> Formatting
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Page Size</label>
                <select name="pageSize" value={form.pageSize} onChange={handleChange} className="w-full p-3 border rounded">
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Header Size</label>
                <input type="number" name="headerFontSize" min={18} max={40} value={form.headerFontSize} onChange={handleChange} className="w-full p-3 border rounded" />
              </div>
              <div>
                <label className="block font-medium mb-1">Question Size</label>
                <input type="number" name="questionFontSize" min={10} max={20} value={form.questionFontSize} onChange={handleChange} className="w-full p-3 border rounded" />
              </div>
              <div>
                <label className="block font-medium mb-1">Option Size</label>
                <input type="number" name="optionFontSize" min={9} max={16} value={form.optionFontSize} onChange={handleChange} className="w-full p-3 border rounded" />
              </div>
            </div>
          </div>

          {/* Format */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded text-white">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                {form.format === "pdf" ? <FaFilePdf className="text-5xl" /> : <FaFileWord className="text-5xl" />}
                <div>
                  <h3 className="text-xl font-bold">Output Format</h3>
                  <p className="text-indigo-100 text-sm">Choose how you want to download the paper</p>
                </div>
              </div>
              <select name="format" value={form.format} onChange={handleChange} className="p-3 w-full bg-white text-indigo-700 rounded font-bold">
                <option value="pdf">PDF</option>
                <option value="docx">Word</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4 border-t">
            <button onClick={onClose} disabled={loading} className="px-6 py-3 w-full border-2 border-gray-300 rounded font-bold">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 w-full  text-white rounded font-bold text-lg flex items-center gap-3 shadow-lg"
            >
              {loading ? <Spinner /> : <FaDownload />}
              {loading ? "Generating..." : "Generate & Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicalPaperModal;
