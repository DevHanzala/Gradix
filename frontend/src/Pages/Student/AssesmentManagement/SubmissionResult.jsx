import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { CheckCircle, XCircle, Clock, Award, FileText, ArrowLeft } from "lucide-react";
import useStudentAssessmentStore from "../../../store/studentAssessmentStore.js";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";

function SubmissionResult() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { submission, loading, error, getSubmissionDetails, clearError } = useStudentAssessmentStore();
  const [showAnswers, setShowAnswers] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });

  // Load submission details on mount
  useEffect(() => {
    getSubmissionDetails(submissionId);
  }, [submissionId, getSubmissionDetails]);

  // Handle errors
  useEffect(() => {
    if (error) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: error || "Failed to load submission details",
      });
      clearError();
      setTimeout(() => navigate("/student/dashboard"), 2000);
    }
  }, [error, clearError, navigate]);

  // Grade color logic
  const getGradeColor = (percentage) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 80) return "text-blue-600";
    if (percentage >= 70) return "text-yellow-600";
    if (percentage >= 60) return "text-orange-600";
    return "text-red-600";
  };

  // Grade letter logic
  const getGradeLetter = (percentage) => {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
  };

  // Format duration
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Show modal
  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner />
        </div>
        <Footer />
      </div>
    );
  }

  // Submission not found
  if (!submission) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Submission Not Found</h1>
            <button
              onClick={() => navigate("/student/dashboard")}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/student/dashboard")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Assessment Results</h1>
          <p className="text-gray-600 mt-2">Submission ID: {submission.submission_id}</p>
        </div>

        {/* Results Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center space-x-3">
              <Award className={`h-8 w-8 ${getGradeColor(submission.percentage)}`} />
              <div>
                <p className="text-sm text-gray-500">Final Score</p>
                <p className={`text-2xl font-bold ${getGradeColor(submission.percentage)}`}>{submission.percentage}%</p>
                <p className={`text-sm font-medium ${getGradeColor(submission.percentage)}`}>
                  Grade: {getGradeLetter(submission.percentage)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Questions Answered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {submission.answered_questions}/{submission.total_questions}
                </p>
                <p className="text-sm text-gray-500">
                  {Math.round((submission.answered_questions / submission.total_questions) * 100)}% completion
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Points Earned</p>
                <p className="text-2xl font-bold text-gray-900">
                  {submission.scored_marks}/{submission.total_marks}
                </p>
                <p className="text-sm text-gray-500">Total marks</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Time Taken</p>
                <p className="text-2xl font-bold text-gray-900">{formatDuration(submission.duration_taken)}</p>
                <p className="text-sm text-gray-500">Duration</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        <div className="mb-8">
          {submission.needs_manual_grading && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <Clock className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Manual Grading Required</h3>
                  <p className="text-yellow-700 text-sm mt-1">
                    Some questions require manual grading by your instructor. Your final score may change once all
                    questions are graded.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-800">Assessment Completed</h3>
                <p className="text-green-700 text-sm mt-1">
                  Your assessment was submitted on {new Date(submission.submitted_at).toLocaleString()}.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Review Answers Section */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Review Your Answers</h2>
              <button
                onClick={() => setShowAnswers(!showAnswers)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                {showAnswers ? "Hide Answers" : "Show Answers"}
              </button>
            </div>
          </div>
          {showAnswers && (
            <div className="p-6">
              <div className="space-y-8">
                {submission.questions_with_answers.map((question, index) => (
                  <div key={question.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-gray-500">Question {question.question_number}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {question.marks} {question.marks === 1 ? "mark" : "marks"}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded capitalize">
                            {question.type.replace("_", " ")}
                          </span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">{question.question}</h3>
                      </div>
                      <div className="ml-4">
                        {question.is_answered ? (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-500" />
                        )}
                      </div>
                    </div>
                    {question.type === "multiple_choice" && question.options && (
                      <div className="space-y-2 mb-4">
                        {question.options.map((option, optionIndex) => {
                          const optionValue = option.charAt(0);
                          const isCorrect = optionValue === question.correct_answer;
                          const isSelected = optionValue === question.student_answer;
                          return (
                            <div
                              key={optionIndex}
                              className={`
                                p-3 rounded-lg border
                                ${
                                  isSelected && isCorrect
                                    ? "border-green-500 bg-green-50"
                                    : isSelected && !isCorrect
                                      ? "border-red-500 bg-red-50"
                                      : isCorrect
                                        ? "border-green-300 bg-green-25"
                                        : "border-gray-200"
                                }
                              `}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-gray-900">{option}</span>
                                <div className="flex items-center space-x-2">
                                  {isSelected && (
                                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                                      Your Answer
                                    </span>
                                  )}
                                  {isCorrect && (
                                    <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {question.type !== "multiple_choice" && (
                      <div className="mb-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Your Answer:</p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          {question.student_answer ? (
                            <p className="text-gray-900 whitespace-pre-wrap">{question.student_answer}</p>
                          ) : (
                            <p className="text-gray-500 italic">No answer provided</p>
                          )}
                        </div>
                      </div>
                    )}
                    {question.explanation && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm font-medium text-blue-800 mb-2">Explanation:</p>
                        <p className="text-blue-700 text-sm">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        title={modal.title}
      >
        {modal.message}
      </Modal>
    </div>
  );
}

export default SubmissionResult;