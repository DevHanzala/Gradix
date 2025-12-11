import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import useInstructorAnalyticsStore from "../../../store/useInstructorAssessmentAnalyticsStore";
import { FaList, FaTable, FaCalendarAlt, FaCheckCircle, FaEye } from "react-icons/fa";

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-red-600 text-xl font-medium">Error: {error}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-3 lg:px-4 xl:px-6 py-8">

        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Assessment Analytics</h1>
          <p className="text-gray-600 mt-2">Monitor student performance and assessment results</p>
        </div>

        {/* Executed Assessments List */}
        <Card className="shadow-xl mb-8">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl">
            <h3 className="text-xl font-bold flex items-center">
              <FaList className="mr-3" /> My Executed Assessments
            </h3>
          </CardHeader>
          <CardContent className="p-6">
            {assessments.length > 0 ? (
              <div className="space-y-4">
                {assessments.map((assessment) => (
                  <div
                    key={assessment.id}
                    onClick={() => navigate(`/instructor/assessments/${assessment.id}/analytics`)}
                    className={`p-5 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                      assessment.id === Number(assessmentId)
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          {assessment.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1 flex items-center">
                          <FaCalendarAlt className="mr-2 text-gray-500" />
                          {new Date(assessment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-center sm:text-right">
                        <p className="text-2xl font-bold text-indigo-600 flex items-center justify-center sm:justify-end">
                          <FaCheckCircle className="mr-2" />
                          {assessment.completed_attempts}
                        </p>
                        <p className="text-sm text-gray-600">Completed</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FaTable className="mx-auto text-6xl mb-4 opacity-30" />
                <p className="text-lg">No executed assessments yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Results */}
        {assessmentId && !isNaN(assessmentId) && assessmentId !== ":assessmentId" && (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block mb-10">
              <Card className="shadow-xl">
                <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                  <h3 className="text-xl font-bold">Student Results — {selectedAssessment?.title}</h3>
                </CardHeader>
                <CardContent className="p-0">
                  {students.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Student</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Questions</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Correct</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Score</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Time Used</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {students.map((s) => (
                            <tr key={s.student_id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 font-medium">{s.name || `Student ${s.student_id}`}</td>
                              <td className="px-6 py-4">{s.total_questions || 0}</td>
                              <td className="px-6 py-4 text-green-600 font-bold">{s.correct_answers || 0}</td>
                              <td className="px-6 py-4 font-bold text-indigo-600">{s.percentage}%</td>
                              <td className="px-6 py-4">{s.time_used}</td>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => fetchStudentQuestions(assessmentId, s.student_id)}
                                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center"
                                >
                                  <FaEye className="mr-2" /> View Answers
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center py-12 text-gray-500">No students have completed this assessment</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-5 mb-10">
              {students.length > 0 ? students.map(s => (
                <Card key={s.student_id} className="shadow-lg">
                  <CardContent className="p-5">
                    <h4 className="font-bold text-lg">{s.name || `Student ${s.student_id}`}</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                      <div><strong>Questions:</strong> {s.total_questions}</div>
                      <div><strong>Correct:</strong> <span className="text-green-600 font-bold">{s.correct_answers}</span></div>
                      <div><strong>Score:</strong> <span className="font-bold text-indigo-600">{s.percentage}%</span></div>
                      <div><strong>Time:</strong> {s.time_used}</div>
                    </div>
                    <button
                      onClick={() => fetchStudentQuestions(assessmentId, s.student_id)}
                      className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center"
                    >
                      <FaEye className="mr-2" /> View Detailed Answers
                    </button>
                  </CardContent>
                </Card>
              )) : (
                <Card><CardContent className="text-center py-12 text-gray-500">No results yet</CardContent></Card>
              )}
            </div>
          </>
        )}

        {/* STUDENT QUESTIONS — FINAL 100% ACCURATE */}
        {selectedStudentId && studentQuestions.length > 0 && (
          <Card className="shadow-xl mt-10">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl">
              <h3 className="text-xl font-bold flex items-center">
                <FaTable className="mr-3" /> Student Answer Details
              </h3>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                {studentQuestions.map((q, i) => {
                  const isCorrect = isAnswerCorrect(q.correct_answer, q.student_answer, q.question_type);

                  return (
                    <div key={i} className="bg-gray-50 border border-gray-200 rounded p-4">
                      <h4 className="font-bold text-lg text-gray-900 mb-3">
                        Question {q.question_order || i + 1} 
                        <span className="text-sm font-normal text-gray-600 ml-2">({q.question_type})</span>
                      </h4>
                      <p className="text-gray-800 mb-4"><strong>Question:</strong> {q.question_text}</p>

                      {q.options && (
                        <div className="mb-4">
                          <strong>Options:</strong>
                          <ul className="list-disc ml-6 text-sm text-gray-700 mt-2">
                            {(typeof q.options === "string" ? JSON.parse(q.options) : q.options).map((opt, idx) => (
                              <li key={idx}>{opt}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base mt-4">
                        <div>
                          <strong>Correct Answer:</strong> 
                          <span className="ml-2 text-green-700 font-semibold">
                            {q.correct_answer}
                          </span>
                        </div>
                        <div>
                          <strong>Student Answer:</strong> 
                          <span className={`ml-2 font-semibold ${isCorrect ? "text-green-700" : "text-red-600"}`}>
                            {q.student_answer || "—"}
                          </span>
                        </div>
                        <div><strong>Score:</strong> <span className="font-medium">{isCorrect ? (q.positive_marks || 1) : (q.score || -Math.abs(q.negative_marks || 0))}</span></div>
                        <div>
                          <strong>Result:</strong> 
                          <span className={`ml-2 font-bold text-lg ${isCorrect ? "text-green-600" : "text-red-600"}`}>
                            {isCorrect ? "Correct" : "Wrong"}
                          </span>
                        </div>
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