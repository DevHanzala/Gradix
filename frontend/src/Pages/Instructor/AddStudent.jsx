import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAssessmentStore from "../../store/assessmentStore.js";
import useAuthStore from "../../store/authStore.js";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Modal from "../../components/ui/Modal";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import toast from "react-hot-toast";
import { FaUser, FaEnvelope, FaLock, FaUserPlus, FaArrowLeft, FaUserGraduate } from "react-icons/fa";

function AddStudent({ assessmentId, onStudentAdded, compact = false }) {
  const navigate = useNavigate();
  const { enrollStudent, loading: enrollLoading } = useAssessmentStore();
  const { registerStudent } = useAuthStore();

  const [mode, setMode] = useState(assessmentId ? "enroll" : "register");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "", title: "", message: "" });

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const showModal = (type, title, message, redirect = false) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);

    if (type === "success" && redirect) {
      setTimeout(() => {
        setModal({ isOpen: false });
        navigate("/instructor/dashboard");
      }, 1500);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showModal("error", "Invalid Input", "Full name is required");
      return;
    }
    if (!formData.email.trim()) {
      showModal("error", "Invalid Input", "Email is required");
      return;
    }
    if (formData.password.length < 6) {
      showModal("error", "Invalid Input", "Password must be at least 6 characters");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      showModal("error", "Invalid Input", "Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await registerStudent({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      if (assessmentId) {
        await enrollStudent(assessmentId, formData.email.trim());
        onStudentAdded?.();
        resetForm();
        showModal("success", "Success", "Student registered and enrolled successfully!");
      } else {
        resetForm();
        showModal("success", "Success", "Student registered successfully!", true);
      }
    } catch (err) {
      showModal("error", "Error", err.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!formData.email.trim()) {
      showModal("error", "Error", "Email is required");
      return;
    }

    try {
      await enrollStudent(assessmentId, formData.email.trim());
      showModal("success", "Success", "Student enrolled successfully!");
      setFormData((prev) => ({ ...prev, email: "" }));
      onStudentAdded?.();
    } catch (err) {
      showModal("error", "Error", err.message || "Enrollment failed");
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition-all";
  const labelClass = "block text-sm font-bold text-gray-700 mb-2";

  const formContent = mode === "register" ? (
    <form onSubmit={handleRegister} className={compact ? "space-y-4" : "space-y-5"}>
      <div>
        <label className={labelClass}>Full Name</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaUser className="text-gray-400" />
          </div>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder="John Doe"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaEnvelope className="text-gray-400" />
          </div>
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder="student@example.com"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Password</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaLock className="text-gray-400" />
          </div>
          <input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder="Min. 6 characters"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Confirm Password</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaLock className="text-gray-400" />
          </div>
          <input
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder="Confirm password"
          />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-400 transition-all"
        >
          <FaArrowLeft />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold disabled:opacity-50 hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" color="white" type="dots" />
              <span>Registering...</span>
            </>
          ) : (
            <>
              <FaUserPlus />
              <span>Register Student</span>
            </>
          )}
        </button>
      </div>
    </form>
  ) : (
    <form onSubmit={handleEnroll} className={compact ? "space-y-4" : "space-y-5"}>
      <div>
        <label className={labelClass}>Student Email</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaEnvelope className="text-gray-400" />
          </div>
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder="student@example.com"
          />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-400 transition-all"
        >
          <FaArrowLeft />
          Cancel
        </button>
        <button
          type="submit"
          disabled={enrollLoading}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold disabled:opacity-50 hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg"
        >
          {enrollLoading ? (
            <>
              <LoadingSpinner size="sm" color="white" type="dots" />
              <span>Enrolling...</span>
            </>
          ) : (
            <>
              <FaUserGraduate />
              <span>Enroll Student</span>
            </>
          )}
        </button>
      </div>
    </form>
  );

  // Standalone page layout
  if (!compact) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Add New Student</h1>
            <p className="text-gray-600 text-sm sm:text-base">Register a new student or enroll an existing one</p>
          </div>
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-gray-200 p-6 sm:p-8">
            <div className="mb-6 pb-6 border-b-2 border-gray-200">
              <button
                onClick={() => setMode((m) => (m === "register" ? "enroll" : "register"))}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold hover:underline transition-colors"
              >
                <FaArrowLeft />
                Switch to {mode === "register" ? "enroll existing" : "register new"}
              </button>
            </div>
            {formContent}
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

  // Compact mode
  return (
    <>
      {assessmentId && (
        <div className="mb-4 -mt-2">
          <button
            onClick={() => setMode((m) => (m === "enroll" ? "register" : "enroll"))}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors"
          >
            {mode === "enroll" ? "→ Register new student instead" : "→ Enroll existing instead"}
          </button>
        </div>
      )}
      {formContent}
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        title={modal.title}
      >
        {modal.message}
      </Modal>
    </>
  );
}

export default AddStudent;