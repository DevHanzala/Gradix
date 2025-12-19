import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { Card, CardContent } from "../components/ui/Card.jsx";
import LoadingSpinner from "../components/ui/LoadingSpinner.jsx";
import Modal from "../components/ui/Modal.jsx";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import { FaEnvelope, FaPaperPlane, FaArrowLeft, FaLock } from "react-icons/fa";

function ResetPassword() {
  const navigate = useNavigate();
  const forgotPassword = useAuthStore((state) => state.forgotPassword);

  const [formData, setFormData] = useState({
    email: "",
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
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      console.log("Sending forgot password request for:", formData.email);

      await forgotPassword({ email: formData.email });

      showModal(
        "success",
        "Reset Link Sent",
        "If an account with that email exists, a password reset link has been sent. Please check your inbox and spam/junk folder. The link will take you to a page to set a new password."
      );

      setTimeout(() => navigate("/login"), 5000);
    } catch (error) {
      console.error("Forgot password error:", error);

      showModal(
        "error",
        "Request Failed",
        error.message || "Failed to send reset link."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <Card className="w-full max-w-md shadow-2xl border-2 border-gray-200 rounded-2xl sm:rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 sm:p-8">
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FaLock className="text-3xl sm:text-4xl" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Forgot Password</h2>
              <p className="text-blue-100 text-sm sm:text-base">Enter your email to receive a password reset link</p>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleForgotSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaEnvelope className="text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${
                      errors.email 
                        ? "border-red-500 focus:ring-red-200" 
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                    }`}
                    placeholder="Enter your email"
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.email}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 sm:py-4 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-bold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" color="white" type="dots" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <>
                    <FaPaperPlane />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t-2 border-gray-200">
              <div className="text-center">
                <Link 
                  to="/login" 
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold hover:underline transition-colors"
                >
                  <FaArrowLeft />
                  <span>Back to Login</span>
                </Link>
              </div>
              
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-gray-700 leading-relaxed">
                  <strong>💡 Note:</strong> The reset link will be sent to your email if an account exists. 
                  Please check your spam folder if you don't see it in your inbox.
                </p>
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

export default ResetPassword;