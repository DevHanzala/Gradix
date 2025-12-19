import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useStudentAssessmentStore from "../../../store/studentAssessmentStore.js";
import { Card } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";
import { 
  FaClock, 
  FaQuestionCircle, 
  FaCheckCircle, 
  FaArrowLeft, 
  FaArrowRight, 
  FaGraduationCap,
  FaFileAlt,
  FaLanguage
} from "react-icons/fa";

function TakeAssessment() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();

  const {
    assessmentQuestions,
    timeRemaining,
    loading,
    error,
    startAssessment,
    updateAnswer,
    submitAssessment,
    isSubmitted,
    hasStarted,
    clearError,
  } = useStudentAssessmentStore();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [modal, setModal] = useState({ isOpen: false, type: "", title: "", message: "" });
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRTL, setIsRTL] = useState(false);

  useEffect(() => {
    if (hasStarted) setIsRTL(["ur", "ar", "fa"].includes(selectedLanguage));
  }, [hasStarted, selectedLanguage]);

  const handleStart = async () => {
    try {
      await startAssessment(assessmentId, selectedLanguage);
      toast.success("Assessment started!");
    } catch (err) {
      toast.error(err.message || "Failed to start");
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isSubmitted) return;
    setIsSubmitting(true);
    try {
      await submitAssessment(assessmentId);
      setModal({ 
        isOpen: true, 
        type: "success", 
        title: "Submitted!", 
        message: "Your assessment has been submitted successfully." 
      });
      toast.success("Submitted successfully!");
    } catch (err) {
      toast.error(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (timeRemaining > 0 && hasStarted && !isSubmitted) {
      const timer = setInterval(() => {
        useStudentAssessmentStore.setState((prev) => {
          if (prev.timeRemaining <= 1) {
            handleSubmit();
            return { timeRemaining: 0 };
          }
          return { timeRemaining: prev.timeRemaining - 1 };
        });
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeRemaining <= 0 && hasStarted && !isSubmitted) {
      handleSubmit();
    }
  }, [timeRemaining, hasStarted, isSubmitted]);

  const currentQuestion = assessmentQuestions[currentQuestionIndex];
  const perQuestionTime = currentQuestion?.duration_per_question || 30;
  const [questionTimeLeft, setQuestionTimeLeft] = useState(perQuestionTime);

  useEffect(() => setQuestionTimeLeft(perQuestionTime), [currentQuestionIndex, perQuestionTime]);

  useEffect(() => {
    if (!hasStarted || isSubmitted || questionTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1 && currentQuestionIndex < assessmentQuestions.length - 1) {
          setCurrentQuestionIndex((i) => i + 1);
          return perQuestionTime;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [questionTimeLeft, hasStarted, isSubmitted, currentQuestionIndex, assessmentQuestions.length, perQuestionTime]);

  const goPrevious = () => currentQuestionIndex > 0 && setCurrentQuestionIndex(i => i - 1);
  const goNext = () => currentQuestionIndex < assessmentQuestions.length - 1 && setCurrentQuestionIndex(i => i + 1);

  const handleAnswer = (qid, answer) => updateAnswer(qid, answer);

  useEffect(() => { 
    if (error) { 
      setModal({ isOpen: true, type: "error", title: "Error", message: error }); 
      clearError(); 
    } 
  }, [error, clearError]);

  const answeredCount = assessmentQuestions.filter(q => q.answer !== undefined).length;
  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading && !hasStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 sm:p-12 shadow-2xl">
            <LoadingSpinner size="lg" type="gradient" color="purple" />
            <p className="mt-6 text-xl sm:text-2xl font-bold text-white">Loading Assessment...</p>
            <p className="mt-2 text-sm text-blue-100">Please wait while we prepare your exam</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900" dir={isRTL ? "rtl" : "ltr"}>
      {/* START SCREEN */}
      {!hasStarted && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-indigo-500/50 animate-fade-in">
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white p-6 sm:p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
              <div className="relative z-10">
                <FaGraduationCap className="text-5xl sm:text-6xl mx-auto mb-4 animate-bounce" />
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-2">Welcome to Your Assessment</h1>
                <p className="text-blue-100 text-sm sm:text-base">Select your preferred language and begin</p>
              </div>
            </div>
            
            <div className="p-6 sm:p-10 space-y-6 sm:space-y-8 bg-white">
              <div>
                <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
                  <FaLanguage className="text-indigo-600" />
                  Select Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full p-4 text-base sm:text-lg border-2 border-indigo-200 rounded-xl focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200 transition-all font-semibold"
                >
                  <option value="en">🇬🇧 English</option>
                  <option value="ur">🇵🇰 Urdu</option>
                  <option value="ar">🇸🇦 Arabic</option>
                  <option value="fa">🇮🇷 Persian</option>
                </select>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-indigo-200 rounded-xl p-4 sm:p-5">
                <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                  <FaFileAlt />
                  Instructions
                </h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Read each question carefully before answering</li>
                  <li>• You can navigate between questions using Previous/Next buttons</li>
                  <li>• Make sure to submit before time runs out</li>
                  <li>• Your progress is automatically saved</li>
                </ul>
              </div>

              <button
                onClick={handleStart}
                disabled={loading}
                className="w-full py-4 sm:py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white text-lg sm:text-xl font-bold rounded-xl sm:rounded-2xl shadow-2xl hover:shadow-indigo-500/50 transition-all disabled:opacity-60 transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" color="white" type="dots" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <FaGraduationCap />
                    <span>Start Assessment</span>
                  </>
                )}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* EXAM IN PROGRESS */}
      {hasStarted && !isSubmitted && currentQuestion && (
        <div className="min-h-screen flex flex-col">
          {/* Top Status Bar */}
          <div className="bg-gradient-to-r from-gray-900 to-indigo-900 shadow-2xl border-b-4 border-indigo-500 sticky top-0 z-50 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-6 text-sm sm:text-base">
                  <div className="bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <FaQuestionCircle />
                    <span className="hidden xs:inline">Q</span> {currentQuestionIndex + 1}/{assessmentQuestions.length}
                  </div>
                  <div className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <FaCheckCircle />
                    <span className="hidden xs:inline">{answeredCount}</span>
                  </div>
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <div className={`${questionTimeLeft <= 5 ? 'bg-red-600 animate-pulse' : 'bg-red-500'} text-white px-3 sm:px-5 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg`}>
                    <FaClock />
                    {formatTime(questionTimeLeft)}
                  </div>
                  <div className="bg-purple-600 text-white px-3 sm:px-5 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg">
                    <span className="hidden xs:inline">Total:</span> {formatTime(timeRemaining)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Question Card */}
          <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
            <div className="w-full max-w-5xl">
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border-2 border-indigo-500/30 animate-slide-in">
                {/* Question Header */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white p-4 sm:p-6 text-center">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold flex items-center justify-center gap-2 sm:gap-3">
                    <FaQuestionCircle className="animate-pulse" />
                    Question {currentQuestionIndex + 1} of {assessmentQuestions.length}
                  </h2>
                </div>

                {/* Question Content */}
                <div className="p-4 sm:p-8 lg:p-10 space-y-6 sm:space-y-8 animate-fade-in">
                  {/* Question Text */}
                  <div className="text-center bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-indigo-200 rounded-2xl p-5 sm:p-6 lg:p-8">
                    <p className="text-lg sm:text-xl lg:text-2xl font-semibold leading-relaxed text-gray-900">
                      {currentQuestion.question_text}
                    </p>
                  </div>

                  {/* Marks Display */}
                  <div className="flex justify-center gap-3 sm:gap-6">
                    <span className="bg-green-100 text-green-800 px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-base sm:text-lg font-bold border-2 border-green-300 shadow-md">
                      +{currentQuestion.positive_marks || 1}
                    </span>
                    {currentQuestion.negative_marks > 0 && (
                      <span className="bg-red-100 text-red-800 px-4 sm:px-6 py-2 sm:py-3 rounded-xl text-base sm:text-lg font-bold border-2 border-red-300 shadow-md">
                        -{currentQuestion.negative_marks}
                      </span>
                    )}
                  </div>

                  {/* Multiple Choice */}
                  {currentQuestion.question_type === "multiple_choice" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {currentQuestion.options?.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleAnswer(currentQuestion.id, opt)}
                          className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl text-base sm:text-lg lg:text-xl font-semibold transition-all border-4 shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 ${
                            currentQuestion.answer === opt
                              ? "border-indigo-600 bg-gradient-to-r from-indigo-100 to-purple-100 scale-105 shadow-indigo-300"
                              : "border-gray-300 bg-white hover:border-indigo-400"
                          }`}
                        >
                          <span className="font-bold text-indigo-600 mr-2">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* True/False */}
                  {currentQuestion.question_type === "true_false" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 max-w-3xl mx-auto">
                      {["True", "False"].map((val) => (
                        <button
                          key={val}
                          onClick={() => handleAnswer(currentQuestion.id, val === "True")}
                          className={`p-8 sm:p-12 rounded-2xl sm:rounded-3xl text-2xl sm:text-3xl lg:text-4xl font-extrabold transition-all border-8 shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 active:translate-y-0 ${
                            currentQuestion.answer === (val === "True")
                              ? val === "True" 
                                ? "border-green-600 bg-gradient-to-br from-green-50 to-green-100 text-green-700 scale-105" 
                                : "border-red-600 bg-gradient-to-br from-red-50 to-red-100 text-red-700 scale-105"
                              : "border-gray-300 bg-white hover:border-gray-400"
                          }`}
                        >
                          {val === "True" ? "✓ TRUE" : "✗ FALSE"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Short Answer */}
                  {currentQuestion.question_type === "short_answer" && (
                    <textarea
                      value={currentQuestion.answer || ""}
                      onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here..."
                      rows={6}
                      className="w-full p-4 sm:p-6 text-base sm:text-lg border-4 border-indigo-200 rounded-2xl focus:border-indigo-600 resize-none focus:ring-4 focus:ring-indigo-200 transition-all"
                    />
                  )}
                </div>

                {/* Navigation Footer */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 border-t-2 border-gray-200">
                  <button
                    onClick={goPrevious}
                    disabled={currentQuestionIndex === 0}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 sm:gap-3 px-5 sm:px-6 py-3 bg-white border-2 border-gray-300 text-gray-800 rounded-xl font-bold disabled:opacity-50 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-md"
                  >
                    <FaArrowLeft />
                    <span>Previous</span>
                  </button>

                  {currentQuestionIndex === assessmentQuestions.length - 1 ? (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl shadow-2xl hover:shadow-green-500/50 transition-all disabled:opacity-50 transform hover:-translate-y-1 active:translate-y-0"
                    >
                      {isSubmitting ? (
                        <>
                          <LoadingSpinner size="sm" color="white" type="dots" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <FaCheckCircle />
                          <span>Submit Exam</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={goNext}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-2xl hover:shadow-indigo-500/50 transition-all transform hover:-translate-y-1 active:translate-y-0"
                    >
                      <span>Next Question</span>
                      <FaArrowRight />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal 
        isOpen={modal.isOpen} 
        onClose={() => { 
          setModal({ ...modal, isOpen: false }); 
          if (modal.type === "success") navigate("/student/dashboard"); 
        }} 
        type={modal.type} 
        title={modal.title}
      >
        <p className="text-lg sm:text-xl text-center">{modal.message}</p>
      </Modal>

      {/* Animations */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(${isRTL ? "-100%" : "100%"}) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}

export default TakeAssessment;