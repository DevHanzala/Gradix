import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import useInstructorAnalyticsStore from "../../../store/useInstructorAssessmentAnalyticsStore";
import { FaList, FaTable, FaCalendarAlt, FaCheckCircle, FaEye, FaChartBar } from "react-icons/fa";

function AssessmentAnalytics() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const {
    loading,
    error,
    assessments,
    students,
    fetchAssessments,
    fetchAssessmentStudents,
    fetchStudentQuestions,
    studentQuestions,
    selectedStudentId,
  } = useInstructorAnalyticsStore();

  const [selectedAssessment, setSelectedAssessment] = useState(null);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  useEffect(() => {
    const isValid = assessmentId && !isNaN(assessmentId) && assessmentId !== ":assessmentId";
    if (isValid) {
      fetchAssessmentStudents(assessmentId);
      const assessment = assessments.find(a => a.id === Number(assessmentId));
      setSelectedAssessment(assessment || null);
    } else {
      setSelectedAssessment(null);
    }
  }, [assessmentId, assessments, fetchAssessmentStudents]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex flex-col items-center justify-center">
        <LoadingSpinner size="lg" type="gradient" />
        <p className="mt-4 text-gray-600 font-medium">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <Card className="max-w-md shadow-lg border-0">
          <CardContent className="p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Error</h3>
            <p className="text-red-600 font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // SMART COMPARISON — WORKS FOR ALL QUESTION TYPES
  const isAnswerCorrect = (correct, student, type) => {
    if (!student) return false;

    let c = String(correct || "").trim();
    let s = String(student || "").trim();

    // Remove escaped quotes and extra spaces
    c = c.replace(/\\"/g, '"').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    s = s.replace(/\\"/g, '"').replace(/^["'\s]+|["'\s]+$/g, '').trim();

    return c.toLowerCase() === s.toLowerCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 sm:py-12 max-w-7xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center">
              <FaChartBar className="text-indigo-600 text-xl" />
            </div>
            Assessment Analytics
          </h1>
          <p className="text-gray-600 ml-0 sm:ml-15">Monitor student performance and assessment results</p>
        </div>

        {/* Executed Assessments List */}
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 mb-8 border-0">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <FaList /> My Executed Assessments
            </h3>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            {assessments.length > 0 ? (
              <div className="space-y-4">
                {assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    onClick={() => navigate(`/instructor/assessments/${assessment.id}/analytics`)}
                    className={`p-5 sm:p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 ${assessment.id === Number(assessmentId)
                        ? "border-indigo-500 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-md scale-[1.02]"
                        : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md"
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <div className="flex-1">
                        <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                          {assessment.title}
                        </h4>
                        <div className="flex items-center text-sm text-gray-600">
                          <FaCalendarAlt className="mr-2 text-indigo-500" />
                          Created: {new Date(assessment.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-center sm:text-right bg-white rounded-lg px-6 py-3 border-2 border-indigo-200">
                        <div className="text-3xl font-bold text-indigo-600 flex items-center justify-center sm:justify-end gap-2">
                          <FaCheckCircle />
                          {assessment.completed_attempts}
                        </div>
                        <p className="text-sm text-gray-600 font-medium mt-1">Completed</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-7xl mb-6 opacity-30">📊</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Executed Assessments</h3>
                <p className="text-gray-600">Execute an assessment to see analytics here</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Results */}
        {assessmentId && !isNaN(assessmentId) && assessmentId !== ":assessmentId" && (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block mb-10">
              <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <h3 className="text-xl font-semibold">Student Results — {selectedAssessment?.title}</h3>
                </CardHeader>
                <CardContent className="p-0">
                  {students.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-gray-100 to-blue-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Questions</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Correct</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Score</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Time Used</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {students.map((s) => (
                            <tr key={s.student_id} className="hover:bg-blue-50 transition-colors duration-150">
                              <td className="px-6 py-4 font-semibold text-gray-900">{s.name || `Student ${s.student_id}`}</td>
                              <td className="px-6 py-4 text-gray-700 font-medium">{s.total_questions || 0}</td>
                              <td className="px-6 py-4">
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-sm">
                                  {s.correct_answers || 0}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-bold text-sm">
                                  {s.percentage}%
                                </span>
                              </td>
                              <td className="px-6 py-4 text-gray-700">{s.time_used}</td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => fetchStudentQuestions(assessmentId, s.student_id)}
                                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 text-sm font-semibold flex items-center gap-2 transition-all duration-200 shadow-sm hover:shadow-md"
                                >
                                  <FaEye /> View Answers
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="text-6xl mb-4 opacity-30">👥</div>
                      <p className="text-gray-500 font-medium">No students have completed this assessment</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4 mb-10">
              {students.length > 0 ? students.map(s => (
                <Card key={s.student_id} className="shadow-md hover:shadow-lg transition-all duration-200 border-0">
                  <CardContent className="p-5">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-4 border-2 border-indigo-200">
                      <h4 className="font-bold text-lg text-gray-900">{s.name || `Student ${s.student_id}`}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <strong className="text-gray-600 text-xs uppercase block mb-1">Questions</strong>
                        <span className="text-lg font-bold text-gray-900">{s.total_questions}</span>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <strong className="text-gray-600 text-xs uppercase block mb-1">Correct</strong>
                        <span className="text-lg font-bold text-green-600">{s.correct_answers}</span>
                      </div>
                      <div className="bg-indigo-50 p-3 rounded-lg">
                        <strong className="text-gray-600 text-xs uppercase block mb-1">Score</strong>
                        <span className="text-lg font-bold text-indigo-600">{s.percentage}%</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <strong className="text-gray-600 text-xs uppercase block mb-1">Time</strong>
                        <span className="text-lg font-bold text-gray-900">{s.time_used}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => fetchStudentQuestions(assessmentId, s.student_id)}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 flex items-center justify-center gap-2 transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <FaEye /> View Detailed Answers
                    </button>
                  </CardContent>
                </Card>
              )) : (
                <Card className="shadow-md border-0">
                  <CardContent className="text-center py-16">
                    <div className="text-6xl mb-4 opacity-30">👥</div>
                    <p className="text-gray-500 font-medium">No results yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}

        {/* STUDENT QUESTIONS — FINAL 100% ACCURATE */}
        {selectedStudentId && studentQuestions.length > 0 && (
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 mt-10 border-0">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <FaTable /> Student Answer Details
              </h3>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <div className="space-y-6">
                {studentQuestions.map((q, i) => {
                  const isCorrect = isAnswerCorrect(q.correct_answer, q.student_answer, q.question_type);

                  return (
                    <div key={i} className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-xl p-5 sm:p-6 hover:border-purple-300 transition-all duration-200">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">
                            Question {q.question_order || i + 1}
                          </span>
                          <span className="text-sm font-normal text-gray-600">({q.question_type})</span>
                        </h4>
                        {/* <div className={`px-4 py-1.5 rounded-full font-bold text-sm ${isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {isCorrect ? "✓ Correct" : "✗ Wrong"}
                        </div> */}
                      </div>

                      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
                        <p className="text-gray-900 font-medium">{q.question_text}</p>
                      </div>

                      {q.options && (
                        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <strong className="text-sm font-semibold text-gray-700 uppercase block mb-2">Options:</strong>
                          <ul className="space-y-1">
                            {(typeof q.options === "string" ? JSON.parse(q.options) : q.options).map((opt, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                <span className="text-blue-600 font-bold">•</span>
                                <span>{opt}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                          <strong className="text-xs font-semibold text-gray-700 uppercase block mb-2">Correct Answer</strong>
                          <p className="font-bold text-lg text-green-700">
                            {q.question_type === 'true_false'
                              ? (q.correct_answer === true || q.correct_answer === 'true' ? 'True' : 'False')
                              : q.correct_answer || "N/A"
                            }
                          </p>
                        </div>
                        <div className={`border-2 rounded-lg p-4 ${isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                          <strong className="text-xs font-semibold text-gray-700 uppercase block mb-2">Student Answer</strong>
                          <p className={`font-bold text-lg ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                            {q.question_type === 'true_false'
                              ? (q.student_answer === true || q.student_answer === 'true' ? 'True' : 'False')
                              : q.student_answer || "—"
                            }
                          </p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <strong className="text-xs font-semibold text-gray-700 uppercase block mb-2">Score</strong>
                          <p className="font-bold text-lg text-gray-900">
                            {isCorrect ? (q.positive_marks || 1) : (q.score || -Math.abs(q.negative_marks || 0))}
                          </p>
                        </div>
                        {/* <div className={`border-2 rounded-lg p-4 ${isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                          <strong className="text-xs font-semibold text-gray-700 uppercase block mb-2">Result</strong>
                          <p className={`font-bold text-xl ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                            {isCorrect ? "✓ Correct" : "✗ Wrong"}
                          </p>
                        </div> */}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
      <Footer />
    </div>
  );
}

export default AssessmentAnalytics;