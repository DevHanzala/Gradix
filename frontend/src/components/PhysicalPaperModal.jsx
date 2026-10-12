import { useState } from "react";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import { FaArrowLeft, FaDownload } from "react-icons/fa";
import { sanitizeFileName } from "../utils/paperUtils";
import { LANGUAGE_OPTIONS, getTranslation, isRTLLanguage } from "../utils/translations";
import useAssessmentStore from "../store/assessmentStore";
import { Button, Input, Modal, Select, Textarea } from "./ui";

const INITIAL_FORM = {
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
};

const PAGE_SIZES = ["A4", "A5", "Letter"].map((v) => ({ value: v, label: v }));
const fontOptions = (min, max) => Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, label: `${min + i} pt` }));

/**
 * Two-step dialog: choose the paper language, then the header and formatting.
 * The server generates a fresh question set in that language and returns a PDF.
 * The dialog itself is shown in the chosen language (RTL for ur/ar/fa).
 */
const PhysicalPaperModal = ({ isOpen, onClose, assessmentId, assessmentTitle }) => {
  const { generatePhysicalPaper } = useAssessmentStore();
  const [step, setStep] = useState("language");
  const [language, setLanguage] = useState("en");
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);

  const t = (key) => getTranslation(language, key);
  const isRTL = isRTLLanguage(language);

  const reset = () => {
    setStep("language");
    setLanguage("en");
    setForm(INITIAL_FORM);
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name.endsWith("FontSize") ? Number(value) : value }));
  };

  const handleSubmit = async () => {
    if (!assessmentId) {
      toast.error(t("noAssessment"));
      return;
    }
    setLoading(true);
    try {
      const blob = await generatePhysicalPaper(assessmentId, { language, ...form });
      saveAs(blob, `${sanitizeFileName(assessmentTitle)}_Paper_${language.toUpperCase()}.pdf`);
      toast.success(t("paperGenerated"));
      reset();
      onClose();
    } catch (error) {
      toast.error(error?.message || t("generationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const footer =
    step === "language" ? (
      <Button variant="secondary" onClick={close}>
        {t("cancel")}
      </Button>
    ) : (
      <>
        <Button variant="secondary" onClick={close} disabled={loading}>
          {t("cancel")}
        </Button>
        <Button icon={FaDownload} loading={loading} onClick={handleSubmit}>
          {loading ? t("generating") : t("generateDownload")}
        </Button>
      </>
    );

  return (
    <Modal isOpen={isOpen} onClose={close} title={t("modalTitle")} size="lg" footer={footer} dir={isRTL ? "rtl" : "ltr"}>
      {step === "language" ? (
        <div>
          <p className="mb-4 text-ink-muted">{t("selectLanguageDesc")}</p>
          <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={t("selectLanguage")}>
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => {
                  setLanguage(lang.value);
                  setStep("form");
                }}
                className="flex min-h-14 items-center justify-center rounded-card border-2 border-line px-4 text-lg font-semibold text-ink transition hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200"
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setStep("language")}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-700 hover:underline"
          >
            <FaArrowLeft aria-hidden="true" className="rtl:rotate-180" />
            {t("back")}
          </button>
          <p className="text-sm text-ink-muted">
            {LANGUAGE_OPTIONS.find((l) => l.value === language)?.label} · {assessmentTitle}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t("instituteName")} name="instituteName" placeholder={t("instituteNamePlaceholder")} value={form.instituteName} onChange={onChange} className="sm:col-span-2" />
            <Input label={t("teacherName")} name="teacherName" placeholder={t("teacherNamePlaceholder")} value={form.teacherName} onChange={onChange} />
            <Input label={t("subjectName")} name="subjectName" placeholder={t("subjectNamePlaceholder")} value={form.subjectName} onChange={onChange} />
            <Input label={t("paperDate")} name="paperDate" type="date" value={form.paperDate} onChange={onChange} />
            <Input label={t("paperTime")} name="paperTime" type="time" value={form.paperTime} onChange={onChange} />
            <Textarea label={t("notes")} name="notes" rows={3} placeholder={t("notesPlaceholder")} value={form.notes} onChange={onChange} className="sm:col-span-2" />
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink">{t("formattingTitle")}</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select label={t("pageSize")} name="pageSize" value={form.pageSize} onChange={onChange} options={PAGE_SIZES} />
              <Select label={t("headerSize")} name="headerFontSize" value={form.headerFontSize} onChange={onChange} options={fontOptions(14, 28)} />
              <Select label={t("questionSize")} name="questionFontSize" value={form.questionFontSize} onChange={onChange} options={fontOptions(8, 16)} />
              <Select label={t("optionSize")} name="optionFontSize" value={form.optionFontSize} onChange={onChange} options={fontOptions(7, 14)} />
            </div>
          </fieldset>
        </div>
      )}
    </Modal>
  );
};

export default PhysicalPaperModal;
