import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
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
  const { getEnrolledStudents, unenrollStudent, enrolledStudents, loading } = useAssessmentStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setIsLoading(true);
      try {
        await getEnrolledStudents(assessmentId);
      } catch (err) {
        showModal("error", "Error", err.message || "Failed to load students");
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [assessmentId, getEnrolledStudents]);

  const handleUnenroll = async (studentId) => {
    try {
      await unenrollStudent(assessmentId, studentId);
      showModal("success", "Success", "Student removed");
      await getEnrolledStudents(assessmentId);
    } catch (err) {
      showModal("error", "Error", err.message || "Failed to unenroll");
    }
  };

  const handleStudentAdded = () => getEnrolledStudents(assessmentId);

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-4 lg:px-8 xl:px-10 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Enroll Students</h1>
          <p className="text-gray-600">Add or remove students from this assessment</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Add Student Form */}
          <Card className="h-fit">
            <CardHeader className="pb-4">
              <h2 className="text-xl font-semibold text-gray-900">Add Student</h2>
            </CardHeader>
            <CardContent className="pt-2">
              <AddStudent compact assessmentId={assessmentId} onStudentAdded={handleStudentAdded} />
            </CardContent>
          </Card>

          {/* Right: Enrolled Students */}
          <Card className="h-fit">
            <CardHeader className="pb-4">
              <h2 className="text-xl font-semibold text-gray-900">Enrolled Students</h2>
            </CardHeader>
            <CardContent className="pt-2">
              {isLoading || loading ? (
                <div className="flex flex-col items-center py-12">
                  <LoadingSpinner size="lg" />
                  <p className="mt-3 text-gray-600">Loading...</p>
                </div>
              ) : enrolledStudents?.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">👩‍🎓</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Students Enrolled</h3>
                  <p className="text-gray-600">Add students using the form to the left.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-hidden rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-3 pl-6 pr-3 text-left text-sm font-semibold text-gray-900">Name</th>
                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                          <th className="pr-6 py-3 text-right text-sm font-semibold text-gray-900">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {enrolledStudents.map((s) => (
                          <tr key={s.id} className="hover:bg-gray-50">
                            <td className="py-4 pl-6 text-sm font-medium text-gray-900">{s.name}</td>
                            <td className="py-4 text-sm text-gray-600">{s.email}</td>
                            <td className="py-4 pr-6 text-right">
                              <button
                                onClick={() => handleUnenroll(s.id)}
                                className="text-red-600 hover:text-red-900 text-sm font-medium"
                              >
                                Unenroll
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3">
                    {enrolledStudents.map((s) => (
                      <div key={s.id} className="bg-white border rounded-lg p-4 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{s.name}</p>
                            <p className="text-sm text-gray-500">{s.email}</p>
                          </div>
                          <button
                            onClick={() => handleUnenroll(s.id)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Unenroll
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />

      <Modal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title}>
        {modal.message}
      </Modal>
    </div>
  );
}

export default EnrollStudents;