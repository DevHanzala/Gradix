import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAssessmentStore from "../../store/assessmentStore.js";
import useAuthStore from "../../store/authStore.js";
import { Card, CardHeader, CardContent } from "../../components/ui/Card";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Modal from "../../components/ui/Modal";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import toast from "react-hot-toast";

function AddStudent({ assessmentId, onStudentAdded }) {
  const navigate = useNavigate();
  const { enrollStudent, loading: enrollLoading } = useAssessmentStore();
  const { registerStudent, token } = useAuthStore(); // Use token from store
  const [mode, setMode] = useState(assessmentId ? "enroll" : "register");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      showModal("error", "Validation Error", "Name is required");
      return;
    }
    if (!formData.email.trim()) {
      showModal("error", "Validation Error", "Email is required");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      showModal("error", "Validation Error", "Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      showModal("error", "Validation Error", "Password must be at least 6 characters long");
      return;
    }

    if (!token) {
      console.warn("⚠️ No authentication token found in store");
      showModal("error", "Authentication Error", "Please log in to register a student");
      return;
    }

    setIsLoading(true);

    try {
      console.log("🔍 Submitting student registration:", { name: formData.name, email: formData.email });
      console.log("🔍 JWT Token from store:", token ? `${token.slice(0, 10)}...` : "undefined");

      await registerStudent({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      showModal("success", "Success", "Student registered successfully!");
      setFormData({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });

      if (assessmentId && onStudentAdded) {
        await enrollStudent(assessmentId, formData.email);
        showModal("success", "Success", "Student enrolled successfully!");
        onStudentAdded();
      } else {
        setTimeout(() => {
          navigate("/instructor/dashboard");
        }, 2000);
      }
    } catch (error) {
      console.error("❌ Registration error:", error);
      const errorMessage = error.message || "Failed to register student";
      showModal("error", "Error", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!formData.email.trim()) {
      showModal("error", "Validation Error", "Student email is required");
      return;
    }

    try {
      await enrollStudent(assessmentId, formData.email);
      showModal("success", "Success", "Student enrolled successfully!");
      setFormData((prev) => ({ ...prev, email: "" }));
      if (onStudentAdded) onStudentAdded();
    } catch (err) {
      showModal("error", "Error", err.message || "Failed to enroll student");
    }
  };

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!assessmentId && <Navbar />}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!assessmentId && (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Add New Student</h1>
            <p className="text-gray-600">Register a new student or enroll an existing student in an assessment</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">
              {mode === "register" ? "Register New Student" : "Enroll Existing Student"}
            </h2>
            {!assessmentId && (
              <div className="mt-2">
                <button
                  onClick={() => setMode(mode === "register" ? "enroll" : "register")}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  {mode === "register" ? "Enroll existing student instead" : "Register new student instead"}
                </button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {mode === "register" ? (
              <form onSubmit={handleRegister} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter student's full name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter student's email address"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter password (min 6 characters)"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm password"
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => navigate("/instructor/dashboard")}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Registering...</span>
                      </div>
                    ) : (
                      "Register Student"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEnroll} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Student Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter student's email address"
                  />
                </div>
                <div className="flex items-center justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => navigate("/instructor/dashboard")}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={enrollLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                  >
                    {enrollLoading ? (
                      <div className="flex items-center">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Enrolling...</span>
                      </div>
                    ) : (
                      "Enroll Student"
                    )}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      {!assessmentId && <Footer />}

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

export default AddStudent;