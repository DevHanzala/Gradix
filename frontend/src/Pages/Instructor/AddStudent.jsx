import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAssessmentStore from "../../store/assessmentStore.js";
import useAuthStore from "../../store/authStore.js";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import Modal from "../../components/ui/Modal";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import toast from "react-hot-toast";

function AddStudent({ assessmentId, onStudentAdded, compact = false }) {
  const navigate = useNavigate();
  const { enrollStudent, loading: enrollLoading } = useAssessmentStore();
  const { registerStudent, token } = useAuthStore();

  const [mode, setMode] = useState(assessmentId ? "enroll" : "register");
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "", title: "", message: "" });

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || formData.password !== formData.confirmPassword || formData.password.length < 6) {
      showModal("error", "Invalid Input", "Please fill all fields correctly");
      return;
    }

    setIsLoading(true);
    try {
      await registerStudent({ name: formData.name, email: formData.email, password: formData.password });
      showModal("success", "Success", "Student registered!");

      if (assessmentId) {
        await enrollStudent(assessmentId, formData.email);
        onStudentAdded?.();
        setFormData({ name: "", email: "", password: "", confirmPassword: "" });
      }
    } catch (err) {
      showModal("error", "Error", err.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!formData.email) return showModal("error", "Error", "Email required");

    try {
      await enrollStudent(assessmentId, formData.email);
      showModal("success", "Success", "Student enrolled!");
      setFormData(prev => ({ ...prev, email: "" }));
      onStudentAdded?.();
    } catch (err) {
      showModal("error", "Error", err.message || "Enrollment failed");
    }
  };

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  const formContent = mode === "register" ? (
    <form onSubmit={handleRegister} className={compact ? "space-y-3" : "space-y-5"}>
      <div>
        <label className={labelClass}>Full Name</label>
        <input name="name" value={formData.name} onChange={handleChange} required className={inputClass} placeholder="John Doe" />
      </div>
      <div>
        <label className={labelClass}>Email</label>
        <input name="email" type="email" value={formData.email} onChange={handleChange} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Password</label>
        <input name="password" type="password" value={formData.password} onChange={handleChange} required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Confirm Password</label>
        <input name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required className={inputClass} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded text-sm">
          Cancel
        </button>
        <button type="submit" disabled={isLoading} className="px-5 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
          {isLoading ? "Registering..." : "Register Student"}
        </button>
      </div>
    </form>
  ) : (
    <form onSubmit={handleEnroll} className={compact ? "space-y-3" : "space-y-5"}>
      <div>
        <label className={labelClass}>Student Email</label>
        <input name="email" type="email" value={formData.email} onChange={handleChange} required className={inputClass} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 text-gray-700 bg-gray-200 rounded text-sm">
          Cancel
        </button>
        <button type="submit" disabled={enrollLoading} className="px-5 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
          {enrollLoading ? "Enrolling..." : "Enroll Student"}
        </button>
      </div>
    </form>
  );

  // Standalone page layout
  if (!compact) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Add New Student</h1>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <button onClick={() => setMode(m => m === "register" ? "enroll" : "register")} className="text-blue-600 hover:underline text-sm">
                ← Switch to {mode === "register" ? "enroll existing" : "register new"}
              </button>
            </div>
            {formContent}
          </div>
        </div>
        <Footer />
        <Modal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title}>
          {modal.message}
        </Modal>
      </div>
    );
  }

  // Compact mode (used inside EnrollStudents page)
  return (
    <>
      {assessmentId && (
        <div className="mb-3 -mt-2">
          <button onClick={() => setMode(m => m === "enroll" ? "register" : "enroll")} className="text-xs text-blue-600 hover:underline">
            {mode === "enroll" ? "Register new student instead" : "Enroll existing instead"}
          </button>
        </div>
      )}
      {formContent}
      <Modal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title}>
        {modal.message}
      </Modal>
    </>
  );
}

export default AddStudent;