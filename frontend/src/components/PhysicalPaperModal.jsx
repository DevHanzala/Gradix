import { useState } from "react";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import { FaArrowLeft, FaDownload } from "react-icons/fa";
import { sanitizeFileName } from "../utils/paperUtils";
import { useTranslation } from "react-i18next";
import { LANGUAGES, isRtl } from "../utils/languages.js";
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
  mode: "same",
  copies: 2,
  format: "pdf",
};

const PAGE_SIZES = ["A4", "A5", "Letter"].map((v) => ({ value: v, label: v })); // paper size names, not translated
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

  const { i18n } = useTranslation();
  // The dialog speaks the paper's language (header labels are printed in it).
  const tPaper = i18n.getFixedT(language);
  const tp = (key) => tPaper(`paper.${key}`);
  const isRTL = isRtl(language);

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
    setForm((f) => ({ ...f, [name]: name.endsWith("FontSize") || name === "copies" ? Number(value) : value }));
  };

  const handleSubmit = async () => {
    if (!assessmentId) {
      toast.error(tp("noAssessment"));
      return;
    }
    setLoading(true);
    try {
      const blob = await generatePhysicalPaper(assessmentId, { language, ...form });
      saveAs(blob, `${sanitizeFileName(assessmentTitle)}_Paper_${language.toUpperCase()}.${form.format}`);
      toast.success(tp("paperGenerated"));
      reset();
      onClose();
    } catch (error) {
      toast.error(error?.message || tp("generationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const footer =
    step === "language" ? (
      <Button variant="secondary" onClick={close}>
        {tp("cancel")}
      </Button>
    ) : (
      <>
        <Button variant="secondary" onClick={close} disabled={loading}>
          {tp("cancel")}
        </Button>
        <Button icon={FaDownload} loading={loading} onClick={handleSubmit}>
          {loading ? tp("generating") : tp("generateDownload")}
        </Button>
      </>
    );

  return (
    <Modal isOpen={isOpen} onClose={close} title={tp("modalTitle")} size="lg" footer={footer} dir={isRTL ? "rtl" : "ltr"}>
      {step === "language" ? (
        <div>
          <p className="mb-4 text-ink-muted">{tp("selectLanguageDesc")}</p>
          <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={tp("selectLanguage")}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                lang={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code);
                  setStep("form");
                }}
                className="flex min-h-14 items-center justify-center rounded-card border-2 border-line px-4 text-lg font-semibold text-ink transition hover:border-primary-300 hover:bg-primary-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200"
              >
                {lang.name}
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
            {tp("back")}
          </button>
          <p className="text-sm text-ink-muted">
            {LANGUAGES.find((l) => l.code === language)?.name} · {assessmentTitle}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={tp("instituteName")} name="instituteName" placeholder={tp("instituteNamePlaceholder")} value={form.instituteName} onChange={onChange} className="sm:col-span-2" />
            <Input label={tp("teacherName")} name="teacherName" placeholder={tp("teacherNamePlaceholder")} value={form.teacherName} onChange={onChange} />
            <Input label={tp("subjectName")} name="subjectName" placeholder={tp("subjectNamePlaceholder")} value={form.subjectName} onChange={onChange} />
            <Input label={tp("paperDate")} name="paperDate" type="date" value={form.paperDate} onChange={onChange} />
            <Input label={tp("paperTime")} name="paperTime" type="time" value={form.paperTime} onChange={onChange} />
            <Textarea label={tp("notes")} name="notes" rows={3} placeholder={tp("notesPlaceholder")} value={form.notes} onChange={onChange} className="sm:col-span-2" />
            <p className="text-sm text-ink-subtle sm:col-span-2">{tp("headerNote")}</p>
          </div>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink">{tp("outputTitle")}</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label={tp("mode")}
                name="mode"
                value={form.mode}
                onChange={onChange}
                options={[
                  { value: "same", label: tp("modeSame") },
                  { value: "unique", label: tp("modeUnique") },
                ]}
              />
              {form.mode === "unique" && (
                <Input label={tp("copies")} name="copies" type="number" min={2} max={40} value={form.copies} onChange={onChange} hint={tp("copiesHint")} />
              )}
              <Select
                label={tp("format")}
                name="format"
                value={form.format}
                onChange={onChange}
                options={[
                  { value: "pdf", label: "PDF" },
                  { value: "docx", label: "Word (DOCX)" }, // i18n-ignore: file format name
                ]}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-ink">{tp("formattingTitle")}</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select label={tp("pageSize")} name="pageSize" value={form.pageSize} onChange={onChange} options={PAGE_SIZES} />
              <Select label={tp("headerSize")} name="headerFontSize" value={form.headerFontSize} onChange={onChange} options={fontOptions(14, 28)} />
              <Select label={tp("questionSize")} name="questionFontSize" value={form.questionFontSize} onChange={onChange} options={fontOptions(8, 16)} />
              <Select label={tp("optionSize")} name="optionFontSize" value={form.optionFontSize} onChange={onChange} options={fontOptions(7, 14)} />
            </div>
          </fieldset>
        </div>
      )}
    </Modal>
  );
};

export default PhysicalPaperModal;
