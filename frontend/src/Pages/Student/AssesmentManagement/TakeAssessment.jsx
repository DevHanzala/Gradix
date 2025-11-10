import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useStudentAssessmentStore from "../../../store/studentAssessmentStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import toast from "react-hot-toast";
import { FaClock, FaQuestion, FaCheck, FaArrowLeft, FaArrowRight, FaPaperPlane } from "react-icons/fa";

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
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRTL, setIsRTL] = useState(false);

  // RTL support applied only when questions start rendering
  useEffect(() => {
    if (hasStarted) {
      const rtlLanguages = ["ur", "ar", "fa"];
      setIsRTL(rtlLanguages.includes(selectedLanguage));
    }
  }, [hasStarted, selectedLanguage]);

  // Start assessment
  const handleStart = async () => {
    try {
      await startAssessment(assessmentId, selectedLanguage);
      toast.success("Assessment started!");
    } catch (err) {
      toast.error(err.message || "Failed to start assessment");
    }
  };

  // Submit assessment
  const handleSubmit = async () => {
    if (isSubmitting || !hasStarted) return;
    setIsSubmitting(true);
    try {
      await submitAssessment(assessmentId);
      setModal({
        isOpen: true,
        type: "success",
        title: "Submitted",
        message: "Assessment submitted successfully!",
      });
      toast.success("Assessment submitted successfully!");
    } catch (err) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Submission Error",
        message: err.message || "Failed to submit assessment.",
      });
      toast.error(err.message || "Failed to submit assessment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Timer management
  useEffect(() => {
    if (timeRemaining > 0 && !isSubmitted && hasStarted) {
      const timer = setInterval(decrementTime, 1000);
      return () => clearInterval(timer);
    } else if (timeRemaining <= 0 && !isSubmitted && hasStarted) {
      handleSubmit();
    }
  }, [timeRemaining, isSubmitted, hasStarted, decrementTime, handleSubmit]);

  // Per-question timer
  const currentQuestion = assessmentQuestions[currentQuestionIndex];
  const perQuestionSeconds = currentQuestion?.duration_per_question || 20;
  const [questionTimeLeft, setQuestionTimeLeft] = useState(perQuestionSeconds);

  useEffect(() => {
    setQuestionTimeLeft(perQuestionSeconds);
  }, [currentQuestionIndex, perQuestionSeconds]);

  useEffect(() => {
    if (questionTimeLeft > 0 && hasStarted && !isSubmitted) {
      const timer = setInterval(() => setQuestionTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (questionTimeLeft <= 0 && currentQuestionIndex < assessmentQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setQuestionTimeLeft(perQuestionSeconds);
    }
  }, [questionTimeLeft, hasStarted, isSubmitted, currentQuestionIndex, assessmentQuestions.length, perQuestionSeconds]);

  // Navigation
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setQuestionTimeLeft(assessmentQuestions[currentQuestionIndex - 1]?.duration_per_question || 20);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < assessmentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setQuestionTimeLeft(assessmentQuestions[currentQuestionIndex + 1]?.duration_per_question || 20);
    }
  };

  // Update answer
  const handleAnswerUpdate = (questionId, answer) => {
    updateAnswer(questionId, answer);
  };

  // Error handling
  useEffect(() => {
    if (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: error,
      });
      clearError();
    }
  }, [error, clearError]);

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? "rtl" : "ltr"} style={{ textAlign: isRTL ? "right" : "left" }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!hasStarted && (
          <Card className="shadow-xl rounded-xl overflow-hidden">
            <CardHeader className="bg-blue-600 text-white">
              <h2 className="text-2xl font-bold">Start Assessment</h2>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                    Select Language
                  </label>
                  <select
                    id="language"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="ur">Urdu</option>
                    <option value="ar">Arabic</option>
                    <option value="fa">Persian</option>
                  </select>
                </div>
                <button
                  onClick={handleStart}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center transition duration-200"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" color="white" />
                      <span className="ml-2">Starting...</span>
                    </>
                  ) : (
                    "Start Assessment"
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && !hasStarted && (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading assessment...</span>
          </div>
        )}

        {hasStarted && !isSubmitted && assessmentQuestions.length > 0 && currentQuestion && (
          <Card className="shadow-xl rounded-xl overflow-hidden">
            <CardHeader className="bg-blue-600 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Assessment</h2>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center bg-blue-700 px-3 py-1 rounded-md">
                    <FaClock className="mr-2" />
                    <span>
                      {Math.floor(questionTimeLeft / 60)}:{(questionTimeLeft % 60).toString().padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex items-center bg-blue-700 px-3 py-1 rounded-md">
                    <FaQuestion className="mr-2" />
                    <span>
                      Question {currentQuestionIndex + 1} of {assessmentQuestions.length}
                    </span>
                  </div>
                  <div className="flex items-center bg-blue-700 px-3 py-1 rounded-md">
                    <FaCheck className="mr-2" />
                    <span>
                      Answered: {assessmentQuestions.filter(q => q.answer !== undefined).length}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-md">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <FaQuestion className="mr-2 text-blue-600" />
                    Q{currentQuestionIndex + 1}. {currentQuestion.question_text} ({currentQuestion.question_type})
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 flex items-center">
                    Marks: +{currentQuestion.positive_marks || 1} / -{currentQuestion.negative_marks || 0} | Time: {questionTimeLeft} seconds
                  </p>
                  {currentQuestion.question_type === "multiple_choice" && (
                    <div className="space-y-3">
                      {currentQuestion.options?.map((option, index) => (
                        <div key={index} className="flex items-center">
                          <input
                            type="radio"
                            id={`option-${index}`}
                            name="mcq-answer"
                            value={option}
                            checked={currentQuestion.answer === option}
                            onChange={(e) => handleAnswerUpdate(currentQuestion.id, e.target.value)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`option-${index}`} className="ml-3 text-gray-700">
                            {option}
                          </label>
                        </div>
                      )) || <p>No options available</p>}
                    </div>
                  )}
                  {currentQuestion.question_type === "true_false" && (
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="true"
                          name="tf-answer"
                          value={true}
                          checked={currentQuestion.answer === true}
                          onChange={(e) => handleAnswerUpdate(currentQuestion.id, true)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="true" className="ml-3 text-gray-700">
                          True
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="false"
                          name="tf-answer"
                          value={false}
                          checked={currentQuestion.answer === false}
                          onChange={(e) => handleAnswerUpdate(currentQuestion.id, false)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="false" className="ml-3 text-gray-700">
                          False
                        </label>
                      </div>
                    </div>
                  )}
                  {currentQuestion.question_type === "short_answer" && (
                    <div>
                      <textarea
                        value={currentQuestion.answer || ""}
                        onChange={(e) => handleAnswerUpdate(currentQuestion.id, e.target.value)}
                        className="w-full border rounded px-3 py-2 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
                        rows={4}
                        placeholder="Type your answer here"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center mt-6">
                  <button
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 flex items-center transition duration-200"
                  >
                    <FaArrowLeft className="mr-2" /> Previous
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={currentQuestionIndex === assessmentQuestions.length - 1}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center transition duration-200"
                  >
                    Next <FaArrowRight className="ml-2" />
                  </button>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !hasStarted || assessmentQuestions.filter(q => q.answer !== undefined).length < assessmentQuestions.length}
                  className="mt-6 w-full px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition duration-200"
                >
                  {isSubmitting ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" color="white" />
                      <span className="ml-2">Submitting...</span>
                    </div>
                  ) : (
                    <>
                      <FaPaperPlane className="mr-2" /> Submit Assessment
                    </>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
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
        {modal.message}
      </Modal>
    </div>
  );
}

export default TakeAssessment;