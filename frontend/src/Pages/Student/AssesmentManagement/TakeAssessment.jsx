  import { useState, useEffect } from "react";
  import { useParams, useNavigate } from "react-router-dom";
  import useStudentAssessmentStore from "../../../store/studentAssessmentStore.js";
  import { Card } from "../../../components/ui/Card";
  import LoadingSpinner from "../../../components/ui/LoadingSpinner";
  import Modal from "../../../components/ui/Modal";
  import toast from "react-hot-toast";
  import { FaClock, FaQuestionCircle, FaCheckCircle, FaArrowLeft, FaArrowRight } from "react-icons/fa";

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
        setModal({ isOpen: true, type: "success", title: "Submitted!", message: "Your assessment has been submitted successfully." });
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
      set((prev) => {
        if (prev.timeRemaining <= 1) {
          handleSubmit(); // Auto-submit when time ends
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

    useEffect(() => { if (error) { setModal({ isOpen: true, type: "error", title: "Error", message: error }); clearError(); } }, [error, clearError]);

    const answeredCount = assessmentQuestions.filter(q => q.answer !== undefined).length;

    const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

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
          <div className="min-h-screen flex items-center justify-center p-6">
            <Card className="w-full  shadow-2xl rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-5 text-center">
                <h1 className="text-3xl font-extrabold">Start Assessment</h1>
              </div>
              <div className="p-10 space-y-8 bg-white">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full p-4 text-lg border-2 border-indigo-200 rounded-xl focus:border-indigo-600"
                >
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                  <option value="ar">Arabic</option>
                  <option value="fa">Persian</option>
                </select>
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition disabled:opacity-60"
                >
                  {loading ? "Starting..." : "Start Assessment"}
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* EXAM IN PROGRESS */}
        {hasStarted && !isSubmitted && currentQuestion && (
          <div className="h-full flex flex-col">
            {/* Top Bar */}
            <div className="bg-white shadow-lg border-b-4 border-indigo-600">
  <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-base font-semibold">
                <div className="flex items-center gap-6">
                  <div className="text-indigo-700"><FaQuestionCircle className="inline mr-2" />{currentQuestionIndex + 1} / {assessmentQuestions.length}</div>
                  <div className="text-green-600"><FaCheckCircle className="inline mr-2" />{answeredCount} Answered</div>
                </div>
                <div className="flex gap-2">
                  <div className="bg-red-500 text-white px-5 py-2 rounded-lg font-bold"><FaClock className="inline mr-2" />{formatTime(questionTimeLeft)}</div>
                  <div className="bg-purple-600 text-white px-5 py-2 rounded-lg font-bold">Total: {formatTime(timeRemaining)}</div>
                </div>
              </div>
            </div>

            {/* Question Card with Slide Animation */}
            <div className="flex-1 flex items-center justify-center p-2">
              <div className="w-full">
                <div className="overflow-hidden rounded shadow-2xl bg-white">
                  <div
                    className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-2 text-center"
                  >
                    <h2 className="text-2xl font-bold">Question {currentQuestionIndex + 1}</h2>
                  </div>

                  <div className="p-8 md:p-5 space-y-3 animate-slide">
                    <div className="text-center">
                      <p className="text-lg md:text-xl font-medium leading-relaxed text-gray-800">
                        {currentQuestion.question_text}
                      </p>
                    </div>

                    {/* Marks */}
                    <div className="flex justify-center gap-6">
                      <span className="bg-green-100 text-green-800 px-6 py-2 rounded text-lg font-bold">+{currentQuestion.positive_marks || 1}</span>
                      {currentQuestion.negative_marks > 0 && (
                        <span className="bg-red-100 text-red-800 px-6 py-2 rounded text-lg font-bold">-{currentQuestion.negative_marks}</span>
                      )}
                    </div>

                    {/* Multiple Choice */}
                    {currentQuestion.question_type === "multiple_choice" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion.options?.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleAnswer(currentQuestion.id, opt)}
                            className={`p-6 rounded-2xl text-xl font-medium transition-all border-4 shadow-md ${
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

                    {/* True/False */}
                    {currentQuestion.question_type === "true_false" && (
                      <div className="grid grid-cols-2 gap-8 max-w-2xl mx-auto">
                        {["True", "False"].map((val) => (
                          <button
                            key={val}
                            onClick={() => handleAnswer(currentQuestion.id, val === "True")}
                            className={`p-12 rounded-3xl text-4xl font-bold transition-all border-8 shadow-xl ${
                              currentQuestion.answer === (val === "True")
                                ? val === "True" ? "border-green-600 bg-green-50 text-green-700" : "border-red-600 bg-red-50 text-red-700"
                                : "border-gray-300 bg-white hover:border-gray-400"
                            }`}
                          >
                            {val}
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
                        className="w-full p-6 text-lg border-4 border-indigo-200 rounded-2xl focus:border-indigo-600 resize-none focus:ring-4 focus:ring-indigo-100"
                      />
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="bg-gray-50 p-4 flex justify-between items-center border-t">
                    <button
                      onClick={goPrevious}
                      disabled={currentQuestionIndex === 0}
                      className="flex items-center gap-3 px-6 py-3 bg-gray-200 text-gray-800 rounded font-bold disabled:opacity-50 hover:bg-gray-300 transition"
                    >
                      <FaArrowLeft /> Previous
                    </button>

                    {currentQuestionIndex === assessmentQuestions.length - 1 ? (
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded shadow-lg hover:shadow-xl transition"
                      >
                        {isSubmitting ? "Submitting..." : "Submit Exam"}
                      </button>
                    ) : (
                      <button
                        onClick={goNext}
                        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition"
                      >
                        Next Question <FaArrowRight />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success/Error Modal */}
        <Modal isOpen={modal.isOpen} onClose={() => { setModal({ ...modal, isOpen: false }); if (modal.type === "success") navigate("/student/dashboard"); }} type={modal.type} title={modal.title}>
          <p className="text-xl text-center">{modal.message}</p>
        </Modal>

        {/* Slide Animation */}
        <style jsx>{`
          @keyframes slide {
            from { opacity: 0; transform: translateX(${isRTL ? "-100%" : "100%"}); }
            to { opacity: 1; transform: translateX(0); }
          }
          .animate-slide { animation: slide 0.5s ease-out; }
        `}</style>
      </div>
    );
  }

  export default TakeAssessment;