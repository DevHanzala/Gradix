import { useState } from "react";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { FaFilePdf, FaTimes, FaGlobe, FaArrowLeft, FaDownload } from "react-icons/fa";
import { sanitizeFileName } from "../utils/paperUtils";
import PaperFormFields from "../components/PaperFormFields";
import FormattingOptions from "../components/FormattingOptions";
import { LANGUAGE_OPTIONS, getTranslation, isRTLLanguage } from "../utils/translations";
import apiClient from "../lib/apiClient";

const PhysicalPaperModal = ({ isOpen, onClose, assessmentId, assessmentTitle }) => {
  const [step, setStep] = useState("language");
  const [selectedLanguage, setSelectedLanguage] = useState("en");

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
  });

  const [loading, setLoading] = useState(false);

  const t = (key) => getTranslation(selectedLanguage, key);
  const isRTL = isRTLLanguage(selectedLanguage);

  const handleLanguageSelect = (lang) => {
    console.log(`[MODAL] Language selected: ${lang}`);
    setSelectedLanguage(lang);
    setStep("form");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!assessmentId) {
      toast.error(t("noAssessment"));
      return;
    }

    console.log(`[MODAL] Starting paper generation...`);
    console.log(`[MODAL] Language: ${selectedLanguage}`);
    console.log(`[MODAL] Form data:`, form);

    setLoading(true);

    try {
      console.log(`[MODAL] Calling backend API...`);

      // Call backend API - it will return PDF directly
      const response = await apiClient.post(
        `/assessments/${assessmentId}/print`,
        {
          language: selectedLanguage,
          instituteName: form.instituteName,
          teacherName: form.teacherName,
          subjectName: form.subjectName,
          paperDate: form.paperDate,
          paperTime: form.paperTime,
          notes: form.notes,
          pageSize: form.pageSize,
          headerFontSize: form.headerFontSize,
          questionFontSize: form.questionFontSize,
          optionFontSize: form.optionFontSize,
        },
        {
          responseType: "blob",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/pdf"
          }
        }
      );


      console.log(`[MODAL] PDF received from backend`);

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileName = `${sanitizeFileName(assessmentTitle)}_Paper_${selectedLanguage.toUpperCase()}.pdf`;

      console.log(`[MODAL] Downloading file: ${fileName}`);
      saveAs(blob, fileName);

      toast.success(t("paperGenerated"));
      onClose();
    } catch (err) {
      console.error("[MODAL] Paper generation error:", err);
      toast.error(t("generationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setStep("language");
    setSelectedLanguage("en");
    setForm({
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
    });
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto animate-in fade-in zoom-in duration-300"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white px-5 sm:px-6 py-4 sm:py-5 rounded-t-2xl sm:rounded-t-3xl flex justify-between items-center shadow-lg z-10">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 sm:p-3 rounded-xl">
              {step === "language" ? (
                <FaGlobe className="text-2xl sm:text-3xl" />
              ) : (
                <FaFilePdf className="text-2xl sm:text-3xl" />
              )}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">{t("modalTitle")}</h2>
              <p className="text-indigo-100 text-xs sm:text-sm truncate max-w-xs sm:max-w-md">
                {step === "language" ? t("modalSubtitle") : assessmentTitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-all duration-200 hover:rotate-90 active:scale-90"
          >
            <FaTimes className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {step === "language" ? (
            /* LANGUAGE SELECTION */
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  {t("selectLanguage")}
                </h3>
                <p className="text-gray-600">
                  {t("selectLanguageDesc")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleLanguageSelect(lang.value)}
                    className="p-6 rounded-2xl border-3 transition-all duration-300 border-gray-300 hover:border-indigo-400 hover:bg-gray-50 flex items-center justify-center gap-3 active:scale-95"
                  >
                    <span className="text-4xl">{lang.label.split(" ")[0]}</span>
                    <span className="text-xl font-bold text-gray-800">
                      {lang.label.split(" ").slice(1).join(" ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* FORM STEP */
            <>
              <button
                onClick={() => setStep("language")}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-semibold transition-colors"
              >
                <FaArrowLeft />
                <span>{t("back")}</span>
              </button>

              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border-2 border-indigo-200">
                <div className="flex items-center gap-3">
                  <FaGlobe className="text-2xl text-indigo-600" />
                  <div>
                    <p className="text-sm text-gray-600">{t("selectLanguage")}</p>
                    <p className="text-lg font-bold text-gray-800">
                      {LANGUAGE_OPTIONS.find(l => l.value === selectedLanguage)?.label}
                    </p>
                  </div>
                </div>
              </div>

              <PaperFormFields
                form={form}
                onChange={handleChange}
                language={selectedLanguage}
              />

              <FormattingOptions
                form={form}
                onChange={handleChange}
                language={selectedLanguage}
              />

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 sm:gap-4 pt-4 border-t-2 border-gray-200">
                <button
                  onClick={handleClose}
                  disabled={loading}
                  className="px-6 py-3 w-full sm:w-auto border-2 border-gray-300 hover:border-gray-400 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 w-full sm:w-auto text-white rounded-xl font-bold text-sm sm:text-lg flex items-center justify-center gap-2 sm:gap-3 shadow-xl hover:shadow-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" color="white" type="dots" />
                      <span>{t("generating")}</span>
                    </>
                  ) : (
                    <>
                      <FaDownload className="text-lg sm:text-xl" />
                      <span>{t("generateDownload")}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhysicalPaperModal;