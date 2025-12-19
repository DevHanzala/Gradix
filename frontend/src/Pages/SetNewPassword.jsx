import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { Card, CardContent } from "../components/ui/Card.jsx";
import LoadingSpinner from "../components/ui/LoadingSpinner.jsx";
import Modal from "../components/ui/Modal.jsx";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import { FaLock, FaCheckCircle, FaArrowLeft, FaKey } from "react-icons/fa";

function SetNewPassword() {
  const navigate = useNavigate();
  const { resetId } = useParams();
  const changePassword = useAuthStore((state) => state.changePassword);

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors((prevErrors) => ({ ...prevErrors, [name]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(formData.newPassword) || !/[0-9]/.test(formData.newPassword)) {
      newErrors.newPassword = "Password must include uppercase letters and numbers";
    }
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      console.log("Submitting new password for resetId:", resetId);
      await changePassword({ newPassword: formData.newPassword, resetId });
      showModal(
        "success",
        "Password Reset",
        "Your password has been successfully reset. You can now log in with your new password."
      );
      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      showModal(
        "error",
        "Reset Failed",
        error.response?.data?.message || "Failed to reset password. The link may be invalid or expired. Please request a new reset link."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <Card className="w-full max-w-md shadow-2xl border-2 border-gray-200 rounded-2xl sm:rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 sm:p-8">
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FaKey className="text-3xl sm:text-4xl" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Set New Password</h2>
              <p className="text-green-100 text-sm sm:text-base">Enter your new password below</p>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-bold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="newPassword"
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                      errors.newPassword 
                        ? "border-red-500 focus:ring-red-200" 
                        : "border-gray-300 focus:border-green-500 focus:ring-green-200"
                    }`}
                    placeholder="Enter new password"
                    required
                  />
                </div>
                {errors.newPassword && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.newPassword}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaCheckCircle className="text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                      errors.confirmPassword 
                        ? "border-red-500 focus:ring-red-200" 
                        : "border-gray-300 focus:border-green-500 focus:ring-green-200"
                    }`}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-gray-700 leading-relaxed">
                  <strong>🔒 Password Requirements:</strong><br/>
                  • At least 8 characters long<br/>
                  • Include uppercase letters<br/>
                  • Include numbers
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 sm:py-4 px-6 rounded-xl hover:from-green-700 hover:to-blue-700 transition-all duration-200 font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" color="white" type="dots" />
                    <span>Setting New Password...</span>
                  </>
                ) : (
                  <>
                    <FaCheckCircle />
                    <span>Set New Password</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t-2 border-gray-200 space-y-3 text-center">
              <Link 
                to="/login" 
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold hover:underline transition-colors"
              >
                <FaArrowLeft />
                <span>Back to Login</span>
              </Link>
              <div>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-gray-600 hover:text-blue-600 font-semibold hover:underline transition-colors"
                >
                  Request a new reset link
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
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

export default SetNewPassword;