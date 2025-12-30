import { useState } from "react";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import axios from "axios";
import LoadingSpinner from "../components/ui/LoadingSpinner";
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


const PhysicalPaperModal = ({ isOpen, onClose, assessmentId, assessmentTitle }) => {
  const [form, setForm] = useState({
    instituteName: "",
    teacherName: "",
    subjectName: "",
    paperDate: "",
    paperTime: "",
    notes: "",
    pageSize: "A4",
    headerFontSize: 26,
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

  const drawWatermarkOnPage = (page, font, w, h) => {
  const wmText = "Gradewise-AI";
  const wmSize = Math.min(w, h) / 8;
  const textWidth = font.widthOfTextAtSize(wmText, wmSize);
  const textHeight = wmSize; // Approximate height

  // True center: account for rotation
  const centerX = w / 2;
  const centerY = h / 2;

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

    const margin = 60;
    const lineHeight = 1.5;
    let y = h - 50;

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

    
    // Store bookmark references
    const bookmarkRefs = [];
    // Enhanced Header Section — Institute Name (NO LINE)
    if (form.instituteName) {
      y = drawText(form.instituteName.toUpperCase(), margin, y, Number(form.headerFontSize), boldFont, rgb(0.1, 0.1, 0.4), "center");
      y -= 20; // Just add some space below name (no line)
    }

    // Information Grid with better spacing
    const infoY = y;
    const leftX = margin;
    const rightX = w / 2 + 40;
    let leftCurrentY = infoY;
    let rightCurrentY = infoY;

    // Left column
    if (form.teacherName) {
      page.drawText("Teacher:", { x: leftX, y: leftCurrentY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(form.teacherName, { x: leftX + 70, y: leftCurrentY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
      leftCurrentY -= 20;
    }
    if (form.subjectName) {
      page.drawText("Subject:", { x: leftX, y: leftCurrentY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(form.subjectName, { x: leftX + 70, y: leftCurrentY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
      leftCurrentY -= 20;
    }

    // Right column
    if (form.paperDate) {
      page.drawText("Date:", { x: rightX, y: rightCurrentY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(form.paperDate, { x: rightX + 50, y: rightCurrentY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
      rightCurrentY -= 20;
    }
    if (form.paperTime) {
      page.drawText("Time:", { x: rightX, y: rightCurrentY, size: 11, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(form.paperTime, { x: rightX + 50, y: rightCurrentY, size: 11, font, color: rgb(0.3, 0.3, 0.3) });
      rightCurrentY -= 20;
    }

    y = Math.min(leftCurrentY, rightCurrentY) - 10;

    // Notes section with box
    if (form.notes.trim()) {
      const notesBoxY = y;
      page.drawRectangle({
        x: margin,
        y: notesBoxY - 60,
        width: w - 2 * margin,
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

    // Enhanced separator line
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: w - margin, y: y },
      thickness: 1.5,
      color: rgb(0, 0, 0),
    });
    
    page.drawLine({
      start: { x: margin, y: y - 3 },
      end: { x: w - margin, y: y - 3 },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });

    y -= 30;

    
    for (let i = 0; i < qList.length; i++) {
      const q = qList[i];

      if (y < 120) {
        page = pdfDoc.addPage([w, h]);
        drawWatermarkOnPage(page, font, w, h);
        y = h - 60;
      }

      // Store page reference for bookmark
      const currentPageIndex = pdfDoc.getPageCount() - 1;
      const currentPage = pdfDoc.getPage(currentPageIndex);
      
      // Create bookmark reference for this question
      const questionBookmarkRef = pdfDoc.context.nextRef();
      bookmarkRefs.push({
        ref: questionBookmarkRef,
        title: `Question ${i + 1}`,
        page: currentPage.ref,
        yPos: y
      });

      // Question number with background
      const qNumText = `Q${i + 1}.`;
      const qNumWidth = boldFont.widthOfTextAtSize(qNumText, Number(form.questionFontSize));
      

      y = drawText(`${qNumText} ${q.question_text}`, margin, y, Number(form.questionFontSize), boldFont, rgb(0.1, 0.1, 0.1)) - 12;

      if (q.options) {
        for (let oi = 0; oi < q.options.length; oi++) {
          if (y < 100) {
            page = pdfDoc.addPage([w, h]);
            drawWatermarkOnPage(page, font, w, h);
            y = h - 40;
          }
          
          // Option circle
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

          y = drawText(q.options[oi], margin + 52, y, Number(form.optionFontSize), font, rgb(0.2, 0.2, 0.2)) - 8;
        }
      }

      y -= 18;
    }

       // Answer Key page — ONE ANSWER PER LINE
    page = pdfDoc.addPage([w, h]);
    drawWatermarkOnPage(page, font, w, h);
    
    let ay = h - 80;
    
    // Header
    ay = drawText("ANSWER KEY", margin, ay, 24, boldFont, rgb(0.1, 0.1, 0.4), "center") - 40;

    // One answer per line — clean vertical list
    qList.forEach((q, i) => {
      if (ay < 100) {
        page = pdfDoc.addPage([w, h]);
        drawWatermarkOnPage(page, font, w, h);
        ay = h - 80;
      }

      const answerText = `Q${i + 1}: ${q.correct_answer || "N/A"}`;
      
      // Use drawText function → supports wrapping for long answers
      ay = drawText(answerText, margin, ay, 12, boldFont, rgb(0.2, 0.2, 0.2)) - 18;
    });

    // Add bookmarks to PDF
const pdfBytes = await pdfDoc.save();
return new Blob([pdfBytes], { type: "application/pdf" });

  };

  const generateDOCX = async (qList) => {
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
        new TextRun({ text: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", size: 20, color: "000000" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 }
    }));

    // Questions
    qList.forEach((q, i) => {
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

    qList.forEach((q, i) =>
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        {/* Header - Enhanced */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white px-5 sm:px-6 py-4 sm:py-5 rounded-t-2xl sm:rounded-t-3xl flex justify-between items-center shadow-lg z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 sm:p-3 rounded-xl">
              <FaFilePdf className="text-2xl sm:text-3xl" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Generate Physical Paper</h2>
              <p className="text-indigo-100 text-xs sm:text-sm truncate max-w-xs sm:max-w-md">{assessmentTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white hover:bg-white/20 rounded-full p-2 transition-all duration-200 hover:rotate-90 active:scale-90"
          >
            <FaTimes className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Input Fields - Enhanced */}
          <div className="space-y-3 sm:space-y-4">
            <div className="group">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Institute Name</label>
              <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-200 focus-within:border-blue-500 focus-within:shadow-lg">
                <div className="bg-blue-600 text-white p-2 rounded-lg">
                  <FaUniversity className="text-lg sm:text-xl" />
                </div>
                <input 
                  type="text" 
                  name="instituteName" 
                  placeholder="Enter institute name" 
                  value={form.instituteName} 
                  onChange={handleChange} 
                  className="w-full bg-transparent outline-none text-sm sm:text-base placeholder-gray-400 font-medium" 
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Teacher Name</label>
              <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-green-50 to-emerald-50 p-3 sm:p-4 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all duration-200 focus-within:border-green-500 focus-within:shadow-lg">
                <div className="bg-green-600 text-white p-2 rounded-lg">
                  <FaChalkboardTeacher className="text-lg sm:text-xl" />
                </div>
                <input 
                  type="text" 
                  name="teacherName" 
                  placeholder="Enter teacher name" 
                  value={form.teacherName} 
                  onChange={handleChange} 
                  className="w-full bg-transparent outline-none text-sm sm:text-base placeholder-gray-400 font-medium" 
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Subject Name</label>
              <div className="flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-purple-50 to-pink-50 p-3 sm:p-4 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-all duration-200 focus-within:border-purple-500 focus-within:shadow-lg">
                <div className="bg-purple-600 text-white p-2 rounded-lg">
                  <FaBook className="text-lg sm:text-xl" />
                </div>
                <input 
                  type="text" 
                  name="subjectName" 
                  placeholder="Enter subject name" 
                  value={form.subjectName} 
                  onChange={handleChange} 
                  className="w-full bg-transparent outline-none text-sm sm:text-base placeholder-gray-400 font-medium" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Paper Date</label>
                <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 p-3 sm:p-4 rounded-xl border-2 border-orange-200 hover:border-orange-400 transition-all duration-200 focus-within:border-orange-500 focus-within:shadow-lg">
                  <div className="bg-orange-600 text-white p-2 rounded-lg">
                    <FaCalendarAlt className="text-base sm:text-lg" />
                  </div>
                  <input 
                    type="date" 
                    name="paperDate" 
                    value={form.paperDate} 
                    onChange={handleChange} 
                    className="w-full bg-transparent outline-none text-sm sm:text-base font-medium" 
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Paper Time</label>
                <div className="flex items-center gap-3 bg-gradient-to-r from-red-50 to-pink-50 p-3 sm:p-4 rounded-xl border-2 border-red-200 hover:border-red-400 transition-all duration-200 focus-within:border-red-500 focus-within:shadow-lg">
                  <div className="bg-red-600 text-white p-2 rounded-lg">
                    <FaClock className="text-base sm:text-lg" />
                  </div>
                  <input 
                    type="time" 
                    name="paperTime" 
                    value={form.paperTime} 
                    onChange={handleChange} 
                    className="w-full bg-transparent outline-none text-sm sm:text-base font-medium" 
                  />
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes (Optional)</label>
              <div className="flex items-start gap-3 sm:gap-4 bg-gradient-to-r from-yellow-50 to-amber-50 p-3 sm:p-4 rounded-xl border-2 border-yellow-200 hover:border-yellow-400 transition-all duration-200 focus-within:border-yellow-500 focus-within:shadow-lg">
                <div className="bg-yellow-600 text-white p-2 rounded-lg mt-1">
                  <FaStickyNote className="text-base sm:text-lg" />
                </div>
                <textarea 
                  name="notes" 
                  rows={3} 
                  value={form.notes} 
                  onChange={handleChange} 
                  placeholder="Enter any additional instructions or notes..." 
                  className="w-full bg-transparent outline-none text-sm sm:text-base resize-none placeholder-gray-400 font-medium" 
                />
              </div>
            </div>
          </div>

          {/* Formatting Section - Enhanced */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-5 border-2 border-gray-200 rounded-2xl shadow-inner">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 mb-4 text-gray-800">
              <div className="bg-indigo-600 text-white p-2 rounded-lg">
                <FaWrench className="text-base sm:text-lg" />
              </div>
              Formatting Options
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Page Size</label>
                <select 
                  name="pageSize" 
                  value={form.pageSize} 
                  onChange={handleChange} 
                  className="w-full p-2 sm:p-3 border-2 border-gray-300 rounded-lg text-sm sm:text-base font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                >
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="Letter">Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Header Size</label>
                <input 
                  type="number" 
                  name="headerFontSize" 
                  min={18} 
                  max={40} 
                  value={form.headerFontSize} 
                  onChange={handleChange} 
                  className="w-full p-2 sm:p-3 border-2 border-gray-300 rounded-lg text-sm sm:text-base font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Question Size</label>
                <input 
                  type="number" 
                  name="questionFontSize" 
                  min={10} 
                  max={20} 
                  value={form.questionFontSize} 
                  onChange={handleChange} 
                  className="w-full p-2 sm:p-3 border-2 border-gray-300 rounded-lg text-sm sm:text-base font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Option Size</label>
                <input 
                  type="number" 
                  name="optionFontSize" 
                  min={9} 
                  max={16} 
                  value={form.optionFontSize} 
                  onChange={handleChange} 
                  className="w-full p-2 sm:p-3 border-2 border-gray-300 rounded-lg text-sm sm:text-base font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all" 
                />
              </div>
            </div>
          </div>

          {/* Format Selection - Enhanced */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 p-4 sm:p-5 rounded-2xl text-white shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl">
                  {form.format === "pdf" ? 
                    <FaFilePdf className="text-3xl sm:text-5xl" /> : 
                    <FaFileWord className="text-3xl sm:text-5xl" />
                  }
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold">Output Format</h3>
                  <p className="text-indigo-100 text-xs sm:text-sm">Choose your preferred format</p>
                </div>
              </div>
              <select 
                name="format" 
                value={form.format} 
                onChange={handleChange} 
                className="p-3 w-full sm:w-48 bg-white text-indigo-700 rounded-xl font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all"
              >
                <option value="pdf">📄 PDF Format</option>
                <option value="docx">📝 Word Format</option>
              </select>
            </div>
          </div>

          {/* Action Buttons - Enhanced */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4 pt-4 border-t-2 border-gray-200">
            <button 
              onClick={onClose} 
              disabled={loading} 
              className="px-6 py-3 w-full sm:w-auto border-2 border-gray-300 hover:border-gray-400 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 w-full sm:w-auto text-white rounded-xl font-bold text-sm sm:text-lg flex items-center justify-center gap-2 sm:gap-3 shadow-xl hover:shadow-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" type="dots" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <FaDownload className="text-lg sm:text-xl" />
                  <span>Generate & Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhysicalPaperModal;