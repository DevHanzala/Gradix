import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import Navbar from "../../../components/Navbar.jsx";
import Footer from "../../../components/Footer.jsx";
import LoadingSpinner from "../../../components/ui/LoadingSpinner.jsx";
import toast from "react-hot-toast";
import { FaCopy, FaEdit, FaArrowLeft, FaEye, FaFileAlt, FaCheckCircle } from "react-icons/fa";

function AssessmentPreview() {
  const { id } = useParams();
  const { getAssessmentById, fetchPreviewQuestions } = useAssessmentStore();

  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("prompt");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getAssessmentById(id);
        setAssessment(data);
      } catch (err) {
        toast.error("Failed to load assessment");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, getAssessmentById]);

  useEffect(() => {
    if (tab === "assessment" && assessment && questions.length === 0) {
      const loadQuestions = async () => {
        try {
          const q = await fetchPreviewQuestions(id);
          setQuestions(q);
        } catch (err) {
          toast.error("Failed to generate sample questions");
        }
      };
      loadQuestions();
    }
  }, [tab, assessment, id, fetchPreviewQuestions, questions.length]);

  const handleCopyPrompt = () => {
    if (!assessment) return;

    const questionTypes = [...new Set(assessment.question_blocks?.map(b => b.question_type) || [])];
    const mcqOptionsCount = assessment.question_blocks?.find(b => b.question_type === "multiple_choice")?.num_options || "N/A";

    let promptText = `Generate questions in English language only. All text MUST be in English.

CONTENT TO BASE QUESTIONS ON:
Title: "${assessment.title}"

Instructor Prompt: "${assessment.prompt || "No prompt provided"}"`;

    if ((assessment.external_links || []).length > 0) {
      promptText += `\nExternal Links: ${assessment.external_links.join(", ")}`;
    }

    if ((assessment.resources || []).length > 0) {
      promptText += `\n\nUploaded Resource Content:\n${assessment.resources.map(r => 
        `Resource "${r.name}":\n${r.chunks?.map(c => c.chunk_text.trim()).join("\n\n") || "No content"}`
      ).join("\n\n---\n\n")}`;
    }

    promptText += `\n\nGenerate questions STRICTLY based on the above content.

Generate ONLY a valid JSON array of questions. NO extra text.

STRICT RULES:
1. Question types exactly: ${questionTypes.join(", ")}
2. Exact counts: ${assessment.question_blocks?.map(b => 
      b.question_type === "multiple_choice" 
        ? `${b.question_count} multiple_choice (${b.num_options} options per question)` 
        : `${b.question_count} ${b.question_type}`
    ).join(", ") || "None"}
3. EVERY question MUST have:
   - question_type
   - question_text
   - options (array for MCQ with exactly ${mcqOptionsCount} options, ["true","false"] for true_false, null for short_answer)
   - correct_answer
   - positive_marks
   - negative_marks
   - duration_per_question`;

    if (assessment.question_blocks?.length > 0) {
      assessment.question_blocks.forEach(b => {
        promptText += `\n4. For ${b.question_type} questions:
      - positive_marks: ${b.positive_marks}
      - negative_marks: ${b.negative_marks}
      - duration_per_question: ${b.duration_per_question} seconds`;
      });
    }

    promptText += `\n5. MCQ correct_answer MUST be the FULL OPTION TEXT like "B. Paris"
6. true_false correct_answer MUST be boolean true/false
7. No missing fields
8. Output ONLY JSON array [ ... ]
9. Respond with ONLY the JSON array.`;

    navigator.clipboard.writeText(promptText.trim());
    setCopied(true);
    toast.success("Exact AI prompt copied — ready for any model!");
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" color="blue" type="dots" />
        <p className="mt-4 text-gray-600 font-medium">Loading assessment...</p>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center px-4">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl border-2 border-red-200">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-red-600 text-xl font-bold">Assessment not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">

        {/* Header Section */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <FaEye className="text-2xl" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Assessment Preview</h1>
                </div>
                <p className="text-blue-100 text-sm sm:text-base">
                  See exactly how the AI will interpret your setup and what students will experience
                </p>
              </div>
              <Link
                to={`/instructor/assessments/${id}/edit`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl hover:bg-blue-50 font-semibold shadow-lg transform transition-all hover:-translate-y-0.5 hover:shadow-xl w-full sm:w-auto"
              >
                <FaEdit className="text-lg" />
                <span>Edit Assessment</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Assessment Title Card */}
        <div className="mb-6 bg-white rounded-xl shadow-lg border-2 border-gray-200 p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <FaFileAlt className="text-indigo-600 text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 break-words">
                {assessment.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                  {assessment.question_blocks?.reduce((sum, b) => sum + (b.question_count || 0), 0) || 0} Questions
                </span>
                {assessment.resources?.length > 0 && (
                  <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
                    {assessment.resources.length} Resources
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 overflow-x-auto">
            <div className="flex min-w-max">
              <button
                onClick={() => setTab("prompt")}
                className={`flex-1 sm:flex-none px-6 sm:px-8 py-4 text-base sm:text-lg font-semibold transition-all whitespace-nowrap ${
                  tab === "prompt"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <FaFileAlt className="hidden sm:inline" />
                  Full AI Prompt
                </span>
              </button>
              <button
                onClick={() => setTab("assessment")}
                className={`flex-1 sm:flex-none px-6 sm:px-8 py-4 text-base sm:text-lg font-semibold transition-all whitespace-nowrap ${
                  tab === "assessment"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <FaEye className="hidden sm:inline" />
                  Sample Assessment
                </span>
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {tab === "prompt" && (
              <div className="animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                  <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Exact Prompt Sent to AI Model</h2>
                    <p className="text-gray-600 text-sm">
                      This is the <strong className="text-blue-600">100% identical prompt</strong> used by Gradewise-AI.<br className="hidden sm:block" />
                      Copy and paste it into ChatGPT, Gemini, Grok, or Claude — <strong className="text-green-600">same result guaranteed</strong>.
                    </p>
                  </div>
                  <button
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-bold shadow-lg transform transition-all hover:-translate-y-0.5 w-full sm:w-auto flex-shrink-0"
                  >
                    {copied ? (
                      <>
                        <FaCheckCircle />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <FaCopy />
                        <span>Copy Full Prompt</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-gray-700 rounded-xl p-4 sm:p-6 lg:p-7 overflow-hidden shadow-2xl">
                  <pre className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-green-400 font-mono overflow-x-auto">
{`Generate questions in English language only. All text MUST be in English.

CONTENT TO BASE QUESTIONS ON:
Title: "${assessment.title}"

Instructor Prompt: "${assessment.prompt || "No prompt provided"}"${(assessment.external_links || []).length > 0 ? `\nExternal Links: ${assessment.external_links.join(", ")}` : ""}${(assessment.resources || []).length > 0 ? `\n\nUploaded Resource Content:\n${assessment.resources.map(r =>
  `Resource "${r.name}":\n${r.chunks?.map(c => c.chunk_text.trim()).join("\n\n") || "No content"}`
).join("\n\n---\n\n")}` : ""}

Generate questions STRICTLY based on the above content.

Generate ONLY a valid JSON array of questions. NO extra text.

STRICT RULES:
1. Question types exactly: ${[...new Set(assessment.question_blocks?.map(b => b.question_type) || [])].join(", ")}
2. Exact counts: ${assessment.question_blocks?.map(b =>
  b.question_type === "multiple_choice"
    ? `${b.question_count} multiple_choice (${b.num_options} options per question)`
    : `${b.question_count} ${b.question_type}`
).join(", ") || "None"}
3. EVERY question MUST have:
   - question_type
   - question_text
   - options (array for MCQ with exactly ${assessment.question_blocks?.find(b => b.question_type === "multiple_choice")?.num_options || "N/A"} options, ["true","false"] for true_false, null for short_answer)
   - correct_answer
   - positive_marks
   - negative_marks
   - duration_per_question
${assessment.question_blocks?.map(b =>
  `4. For ${b.question_type} questions:
      - positive_marks: ${b.positive_marks}
      - negative_marks: ${b.negative_marks}
      - duration_per_question: ${b.duration_per_question} seconds`
).join("\n") || ""}
5. MCQ correct_answer MUST be the FULL OPTION TEXT like "B. Paris"
6. true_false correct_answer MUST be boolean true/false
7. No missing fields
8. Output ONLY JSON array [ ... ]
9. Respond with ONLY the JSON array.`}
                  </pre>
                </div>
              </div>
            )}

            {tab === "assessment" && (
              <div className="animate-fadeIn">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
                  Sample Questions (What Students Will See)
                </h2>
                {questions.length === 0 ? (
                  <div className="text-center py-16 sm:py-20">
                    <LoadingSpinner size="lg" color="blue" type="dots" />
                    <p className="mt-4 text-gray-600 font-medium">Generating real sample questions from AI...</p>
                  </div>
                ) : (
                  <div className="space-y-4 sm:space-y-6">
                    {questions.map((q, idx) => (
                      <div
                        key={idx}
                        className="bg-white border-2 border-gray-200 rounded-xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-200 animate-slideInUp"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-lg">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base sm:text-lg font-semibold text-gray-900 mb-4 break-words">
                              {q.question_text}
                            </p>

                            {/* Options Display */}
                            {q.question_type === "true_false" ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                                  <div className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center font-semibold text-gray-700 flex-shrink-0">
                                    T
                                  </div>
                                  <span className="text-gray-800 font-medium">True</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                                  <div className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center font-semibold text-gray-700 flex-shrink-0">
                                    F
                                  </div>
                                  <span className="text-gray-800 font-medium">False</span>
                                </div>
                              </div>
                            ) : q.options ? (
                              <div className="space-y-2">
                                {Object.entries(q.options).map(([key, text]) => (
                                  <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                                    <div className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center font-semibold text-gray-700 flex-shrink-0">
                                      {key}
                                    </div>
                                    <span className="text-gray-800 break-words">{text}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 text-xs sm:text-sm text-gray-600">
                              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
                                {q.question_type.replace("_", " ")}
                              </span>
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                                +{q.positive_marks} marks
                              </span>
                              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
                                -{q.negative_marks} marks
                              </span>
                              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                                {q.duration_per_question}s
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6 sm:mt-8 text-center">
          <Link
            to="/instructor/assessments"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl hover:from-gray-700 hover:to-gray-800 font-medium shadow-lg transform transition-all hover:-translate-y-0.5"
          >
            <FaArrowLeft />
            <span>Back to Assessments</span>
          </Link>
        </div>
      </div>
      <Footer />

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }

        .animate-slideInUp {
          animation: slideInUp 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

export default AssessmentPreview;