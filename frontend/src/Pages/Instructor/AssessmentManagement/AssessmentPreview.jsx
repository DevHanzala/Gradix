import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import LoadingSpinner from "../../../components/ui/LoadingSpinner.jsx";
import AssessmentHeader from "../../../components/AssessmentHeader.jsx";
import AssessmentInfoCard from "../../../components/AssessmentInfoCard.jsx";
import PromptTab from "../../../components/PromptTab.jsx";
import SampleQuestionsTab from "../../../components/SampleQuestionsTab.jsx";
import useAssessmentPreview from "../../../hooks/useAssessmentPreview.js";
import { generateAIPrompt } from "../../../utils/promptGenerator.js";

function AssessmentPreview() {
  const { id } = useParams();
  const [tab, setTab] = useState("prompt");
  const [copied, setCopied] = useState(false);

  const {
    assessment,
    questions,
    loading,
    error,
    questionError,
    questionsLoading,
    loadPreviewQuestions
  } = useAssessmentPreview(id);

  // Load questions when switching to assessment tab
  useEffect(() => {
    if (tab === "assessment" && assessment) {
      loadPreviewQuestions();
    }
  }, [tab, assessment]);

  const handleCopyPrompt = () => {
    if (!assessment) return;
    
    const promptText = generateAIPrompt(assessment);
    navigator.clipboard.writeText(promptText);
    setCopied(true);
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
        <div className="bg-white border-2 border-red-200 rounded-2xl p-8 shadow-xl text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Unable to Load Assessment</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/instructor/assessments"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            <FaArrowLeft />
            Back to Assessments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        
        <AssessmentHeader assessmentId={id} />
        <AssessmentInfoCard assessment={assessment} />

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
                Full AI Prompt
              </button>
              <button
                onClick={() => setTab("assessment")}
                className={`flex-1 sm:flex-none px-6 sm:px-8 py-4 text-base sm:text-lg font-semibold transition-all whitespace-nowrap ${
                  tab === "assessment"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                Sample Assessment
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {tab === "prompt" && (
              <PromptTab 
                assessment={assessment} 
                copied={copied} 
                onCopy={handleCopyPrompt} 
              />
            )}

            {tab === "assessment" && (
              <SampleQuestionsTab 
                questions={questions} 
                questionError={questionError} 
                loading={questionsLoading || (questions.length === 0 && !questionError)}
              />
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

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
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