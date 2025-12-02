import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useStudentAssessmentStore from "../../../store/studentAssessmentStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";
import { FaClock, FaQuestionCircle, FaCheckCircle } from "react-icons/fa";

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
    decrementTime,
    isSubmitted,
    hasStarted,
    clearError,
  } = useStudentAssessmentStore();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [modal, setModal] = useState({ isOpen: false, type: "", title: "", message: "" });
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRTL, setIsRTL] = useState(false);

  // RTL Support
  useEffect(() => {
    if (hasStarted) {
      setIsRTL(["ur", "ar", "fa"].includes(selectedLanguage));
    }
  }, [hasStarted, selectedLanguage]);

  // Start Assessment
  const handleStart = async () => {
    try {
      await startAssessment(assessmentId, selectedLanguage);
      toast.success("Assessment started!");
    } catch (err) {
      toast.error(err.message || "Failed to start");
    }
  };

  // Submit Assessment
  const handleSubmit = async () => {
    if (isSubmitting || isSubmitted) return;
    setIsSubmitting(true);
    try {
      await submitAssessment(assessmentId);
      setModal({
        isOpen: true,
        type: "success",
        title: "Submitted!",
        message: "Your assessment has been submitted successfully.",
      });
      toast.success("Submitted successfully!");
    } catch (err) {
      toast.error(err.message || "Submission failed");
      setModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to submit.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Global Timer (auto-submit when time ends)
  useEffect(() => {
    if (timeRemaining > 0 && hasStarted && !isSubmitted) {
      const timer = setInterval(decrementTime, 1000);
      return () => clearInterval(timer);
    } else if (timeRemaining <= 0 && hasStarted && !isSubmitted) {
      handleSubmit();
    }
  }, [timeRemaining, hasStarted, isSubmitted, decrementTime, handleSubmit]);

  // Current Question & Per-Question Timer
  const currentQuestion = assessmentQuestions[currentQuestionIndex];
  const perQuestionTime = currentQuestion?.duration_per_question || 30;
  const [questionTimeLeft, setQuestionTimeLeft] = useState(perQuestionTime);

  useEffect(() => {
    setQuestionTimeLeft(perQuestionTime);
  }, [currentQuestionIndex, perQuestionTime]);

  useEffect(() => {
    if (!hasStarted || isSubmitted || questionTimeLeft <= 0) return;

    const timer = setInterval(() => {
      setQuestionTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-move to next question
          if (currentQuestionIndex < assessmentQuestions.length - 1) {
            setCurrentQuestionIndex((i) => i + 1);
          }
          return perQuestionTime;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [questionTimeLeft, hasStarted, isSubmitted, currentQuestionIndex, assessmentQuestions.length, perQuestionTime]);

  // Navigation
  const goPrevious = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex((i) => i - 1);
  };

  const goNext = () => {
    if (currentQuestionIndex < assessmentQuestions.length - 1) setCurrentQuestionIndex((i) => i + 1);
  };

  // Answer Update
  const handleAnswer = (qid, answer) => {
    updateAnswer(qid, answer);
  };

  // Error Modal
  useEffect(() => {
    if (error) {
      setModal({ isOpen: true, type: "error", title: "Error", message: error });
      clearError();
    }
  }, [error, clearError]);

  const answeredCount = assessmentQuestions.filter((q) => q.answer !== undefined).length;

  // Format time
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (loading && !hasStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-6 text-2xl font-bold text-indigo-700">Loading Assessment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100" dir={isRTL ? "rtl" : "ltr"}>
      {/* START SCREEN */}
      {!hasStarted && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-10 text-center">
              <h1 className="text-4xl font-extrabold">Start Assessment</h1>
            </CardHeader>
            <CardContent className="p-8 space-y-8 bg-white">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full p-5 text-xl border-4 border-indigo-200 rounded-2xl focus:border-indigo-600"
              >
                <option value="en">English</option>
                <option value="ur">Urdu</option>
                <option value="ar">Arabic</option>
                <option value="fa">Persian</option>
              </select>
              <button
                onClick={handleStart}
                disabled={loading}
                className="w-full py-6 bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-2xl font-bold rounded-2xl shadow-xl hover:shadow-2xl transition disabled:opacity-60"
              >
                {loading ? "Starting..." : "Start Assessment"}
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EXAM IN PROGRESS */}
      {hasStarted && !isSubmitted && currentQuestion && (
        <div className="min-h-screen flex flex-col">
          {/* Top Status Bar */}
          <div className="bg-white shadow-2xl border-b-8 border-indigo-600">
            <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-8 text-xl font-bold">
                <div className="text-indigo-700">
                  <FaQuestionCircle className="inline mr-2" />
                  {currentQuestionIndex + 1} / {assessmentQuestions.length}
                </div>
                <div className="text-green-600">
                  <FaCheckCircle className="inline mr-2" />
                  {answeredCount} Answered
                </div>
              </div>
              <div className="flex gap-6">
                <div className="bg-red-500 text-white px-8 py-4 rounded text-xl font-bold shadow-lg">
                  <FaClock className="inline mr-2" />
                  {formatTime(questionTimeLeft)}
                </div>
                <div className="bg-purple-600 text-white px-8 py-4 rounded text-xl font-bold shadow-lg">
                  Total: {formatTime(timeRemaining)}
                </div>
              </div>
            </div>
          </div>

          {/* Main Question Card */}
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="w-full max-w-4xl shadow-2xl rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-8 text-center">
                <h2 className="text-4xl font-extrabold">Question {currentQuestionIndex + 1}</h2>
              </div>

              <CardContent className="p-10 space-y-12 bg-gradient-to-b from-gray-50 to-white">
                {/* Question Text */}
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-medium leading-relaxed text-gray-800">
                    {currentQuestion.question_text}
                  </p>
                </div>

                {/* Marks */}
                <div className="flex justify-center gap-6 flex-wrap">
                  <span className="bg-green-100 text-green-800 px-8 py-4 rounded-full text-xl font-bold">
                    +{currentQuestion.positive_marks || 1}
                  </span>
                  {currentQuestion.negative_marks > 0 && (
                    <span className="bg-red-100 text-red-800 px-8 py-4 rounded-full text-xl font-bold">
                      -{currentQuestion.negative_marks}
                    </span>
                  )}
                </div>

                {/* Answer Options */}
                {currentQuestion.question_type === "multiple_choice" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {currentQuestion.options?.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnswer(currentQuestion.id, opt)}
                        className={`p-10 rounded-3xl text-2xl font-semibold transition-all border-4 shadow-lg ${
                          currentQuestion.answer === opt
                            ? "border-indigo-600 bg-indigo-50 scale-105"
                            : "border-gray-300 bg-white hover:border-indigo-400"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {currentQuestion.question_type === "true_false" && (
                  <div className="grid grid-cols-2 gap-12 max-w-3xl mx-auto">
                    <button
                      onClick={() => handleAnswer(currentQuestion.id, true)}
                      className={`p-20 rounded-3xl text-6xl font-extrabold transition-all border-8 shadow-2xl ${
                        currentQuestion.answer === true
                          ? "border-green-600 bg-green-50 text-green-700 scale-110"
                          : "border-gray-300 bg-white hover:border-green-400"
                      }`}
                    >
                      True
                    </button>
                    <button
                      onClick={() => handleAnswer(currentQuestion.id, false)}
                      className={`p-20 rounded-3xl text-6xl font-extrabold transition-all border-8 shadow-2xl ${
                        currentQuestion.answer === false
                          ? "border-red-600 bg-red-50 text-red-700 scale-110"
                          : "border-gray-300 bg-white hover:border-red-400"
                      }`}
                    >
                      False
                    </button>
                  </div>
                )}

                {currentQuestion.question_type === "short_answer" && (
                  <textarea
                    value={currentQuestion.answer || ""}
                    onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    placeholder="Type your answer here..."
                    rows={8}
                    className="w-full p-8 text-xl border-4 border-indigo-200 rounded-3xl focus:border-indigo-600 resize-none focus:ring-4 focus:ring-indigo-100"
                  />
                )}

                {/* Navigation */}
                <div className="flex justify-between items-center pt-10">
                  <button
                    onClick={goPrevious}
                    disabled={currentQuestionIndex === 0}
                    className="px-5 py-5 bg-gray-200 text-gray-800 rounded-xl text-lg font-bold disabled:opacity-50"
                  >
                    Previous
                  </button>

                  {currentQuestionIndex === assessmentQuestions.length - 1 ? (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="px-5 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-lg font-bold rounded-xl shadow-2xl"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Exam"}
                    </button>
                  ) : (
                    <button
                      onClick={goNext}
                      className="px-12 py-6 bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-2xl font-bold rounded-2xl shadow-xl"
                    >
                      Next Question
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => {
          setModal({ ...modal, isOpen: false });
          if (modal.type === "success") {
            navigate("/student/dashboard");
          }
        }}
        type={modal.type}
        title={modal.title}
      >
        <p className="text-2xl text-center font-medium">{modal.message}</p>
      </Modal>
    </div>
  );
}

export default TakeAssessment;