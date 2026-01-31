// PHYSICAL PAPER MODAL - UI Component Only (Clean & Focused)
import { useState } from "react";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import useAssessmentStore from "../store/assessmentStore";
import { FaFilePdf, FaFileWord, FaDownload, FaTimes } from "react-icons/fa";
import { generatePDF } from "../utils/pdfGenerator";
import { generateDOCX } from "../utils/docxGenerator";
import { sanitizeFileName } from "../utils/paperUtils";
import PaperFormFields from "../components/PaperFormFields";
import FormattingOptions from "../components/FormattingOptions";

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
    questionFontSize: 10,
    optionFontSize: 9,
    format: "pdf",
    language: "en",
  });

  const [loading, setLoading] = useState(false);
  const { generatePhysicalPaper } = useAssessmentStore();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!assessmentId) {
      toast.error("No assessment selected");
      return;
    }

    setLoading(true);

    try {
      const response = await generatePhysicalPaper(assessmentId, {
        language: form.language,
        instituteName: form.instituteName,
        teacherName: form.teacherName,
        subjectName: form.subjectName,
        paperDate: form.paperDate,
        paperTime: form.paperTime,
        notes: form.notes,
      });

      if (!response.success || !response.data?.questions?.length) {
        toast.error("No questions received");
        return;
      }

      const { questions, isRTL } = response.data;

      const blob = form.format === "pdf"
        ? await generatePDF(questions, form, isRTL)
        : await generateDOCX(questions, form);

      const ext = form.format === "pdf" ? "pdf" : "docx";
      const fileName = `${sanitizeFileName(assessmentTitle)}_Paper_${form.language.toUpperCase()}.${ext}`;

      saveAs(blob, fileName);
      toast.success(`Paper generated in ${form.language.toUpperCase()}!`);
      onClose();
    } catch (err) {
      console.error("Paper generation error:", err);
      toast.error("Failed to generate paper");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white px-5 sm:px-6 py-4 sm:py-5 rounded-t-2xl sm:rounded-t-3xl flex justify-between items-center shadow-lg z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 sm:p-3 rounded-xl">
              <FaFilePdf className="text-2xl sm:text-3xl" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Generate Physical Paper</h2>
              <p className="text-indigo-100 text-xs sm:text-sm truncate max-w-xs sm:max-w-md">
                {assessmentTitle}
              </p>
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
          {/* Form Fields Component */}
          <PaperFormFields form={form} onChange={handleChange} />

          {/* Formatting Options Component */}
          <FormattingOptions form={form} onChange={handleChange} />

          {/* Format Selection */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 p-4 sm:p-5 rounded-2xl text-white shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-xl">
                  {form.format === "pdf" ? (
                    <FaFilePdf className="text-3xl sm:text-5xl" />
                  ) : (
                    <FaFileWord className="text-3xl sm:text-5xl" />
                  )}
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

          {/* Action Buttons */}
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