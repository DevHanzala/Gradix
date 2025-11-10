import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import AddStudent from "../AddStudent.jsx";
import toast from "react-hot-toast";

function EnrollStudents() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { getEnrolledStudents, unenrollStudent, enrolledStudents, loading } = useAssessmentStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEnrolledStudents = async () => {
      setIsLoading(true);
      try {
        await getEnrolledStudents(assessmentId);
      } catch (error) {
        console.error("❌ Failed to fetch enrolled students:", error);
        showModal("error", "Error", error.message || "Failed to fetch enrolled students");
      } finally {
        setIsLoading(false);
      }
    };
    fetchEnrolledStudents();
  }, [assessmentId, getEnrolledStudents]);

  const handleUnenroll = async (studentId) => {
    try {
      await unenrollStudent(assessmentId, studentId);
      showModal("success", "Success", "Student unenrolled successfully!");
      await getEnrolledStudents(assessmentId); // Refresh list
    } catch (error) {
      console.error("❌ Unenroll error:", error);
      showModal("error", "Error", error.message || "Failed to unenroll student");
    }
  };

  const handleStudentAdded = () => {
    getEnrolledStudents(assessmentId); // Refresh enrolled students list
  };

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Enroll Students</h1>
          <p className="text-gray-600">Enroll students in the assessment or register new students</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Enroll Student Form */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">Add Student to Assessment</h2>
            </CardHeader>
            <CardContent>
              <AddStudent assessmentId={assessmentId} onStudentAdded={handleStudentAdded} />
            </CardContent>
          </Card>

          {/* Enrolled Students List */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">Enrolled Students</h2>
            </CardHeader>
            <CardContent>
              {isLoading || loading ? (
                <div className="flex justify-center items-center h-64">
                  <LoadingSpinner size="lg" />
                  <span className="ml-3 text-gray-600">Loading enrolled students...</span>
                </div>
              ) : !enrolledStudents || enrolledStudents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">👩‍🎓</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Enrolled</h3>
                  <p className="text-gray-600">Add students using the form to the left.</p>
                </div>
              ) : (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                        >
                          Name
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Email
                        </th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {enrolledStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {student.name}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {student.email}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button
                              onClick={() => handleUnenroll(student.id)}
                              className="text-red-600 hover:text-red-900"
                              disabled={loading}
                            >
                              Unenroll
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
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

export default EnrollStudents;