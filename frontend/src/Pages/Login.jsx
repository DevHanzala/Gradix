import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import useAuthStore from "../store/authStore.js";
import { Card, CardHeader, CardContent } from "../components/ui/Card.jsx";
import LoadingSpinner from "../components/ui/LoadingSpinner.jsx";
import Modal from "../components/ui/Modal.jsx";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import toast from "react-hot-toast";
import axios from "axios";
import { loadRecaptcha, getCaptchaToken } from "../config/captcha.js";
import { FaEnvelope, FaLock, FaSignInAlt, FaGoogle, FaUserCircle } from "react-icons/fa";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

function Login() {
  const navigate = useNavigate();
  const { login, googleAuth } = useAuthStore();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    if (siteKey) {
      loadRecaptcha(siteKey).catch(console.error);
    }
  }, [siteKey]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  const redirectUser = (user) => {
    switch (user.role) {
      case "super_admin":
        navigate("/super-admin/dashboard");
        break;
      case "admin":
        navigate("/admin/dashboard");
        break;
      case "instructor":
        navigate("/instructor/dashboard");
        break;
      case "student":
        navigate("/student/dashboard");
        break;
      default:
        navigate("/profile");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      loginSchema.parse(formData);
      const captchaToken = await getCaptchaToken(siteKey, "login");
      const response = await login({ ...formData, captchaToken });
      const token = useAuthStore.getState().token;
      localStorage.setItem("token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      console.log("Login successful, token set:", token.slice(0, 10) + "...");
      showModal("success", "Login Successful!", `Welcome back, ${response.name}!`);

      setTimeout(() => {
        redirectUser(response);
      }, 1500);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = {};
        error.errors.forEach((err) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        const errorMessage = error.response?.data?.message || "Login failed. Please try again.";
        showModal("error", "Login Failed", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const response = await googleAuth();
      const token = useAuthStore.getState().token;
      localStorage.setItem("token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      console.log("Google login successful, token set:", token.slice(0, 10) + "...");
      showModal("success", "Welcome!", `Successfully signed in with Google! Welcome back, ${response.name}!`);

      setTimeout(() => {
        redirectUser(response);
      }, 1500);
    } catch (error) {
      console.error("Google login error:", error);
      const errorMessage = error.response?.data?.message || error.message || "Google login failed. Please try again.";
      showModal("error", "Google Login Failed", errorMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />
      <div className="flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md shadow-2xl border-2 border-gray-200 rounded-2xl sm:rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 sm:p-8">
            <div className="text-center">
              <div className="bg-white/20 backdrop-blur-sm w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FaUserCircle className="text-3xl sm:text-4xl" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Welcome Back</h2>
              <p className="text-blue-100 text-sm sm:text-base">Sign in to your Gradewise AI account</p>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            {/* Google Login Button - Enhanced */}
            <button
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 sm:py-4 border-2 border-gray-300 rounded-xl shadow-md bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mb-6 font-semibold"
            >
              {googleLoading ? (
                <LoadingSpinner size="sm" type="dots" color="blue" />
              ) : (
                <>
                  <FaGoogle className="text-xl" />
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Divider - Enhanced */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-semibold">Or continue with email</span>
              </div>
            </div>

            {/* Form - Enhanced */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaEnvelope className="text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl shadow-sm focus:outline-none focus:ring-4 transition-all duration-200 ${
                      errors.email 
                        ? "border-red-500 focus:ring-red-200" 
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                    }`}
                    placeholder="Enter your email address"
                  />
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl shadow-sm focus:outline-none focus:ring-4 transition-all duration-200 ${
                      errors.password 
                        ? "border-red-500 focus:ring-red-200" 
                        : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                    }`}
                    placeholder="Enter your password"
                  />
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <span>⚠️</span>
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Submit Button - Enhanced */}
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full flex items-center justify-center gap-2 py-3 sm:py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? (
                  <LoadingSpinner size="sm" color="white" type="dots" />
                ) : (
                  <>
                    <FaSignInAlt />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Links - Enhanced */}
            <div className="mt-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Don't have an account?{" "}
                  <Link 
                    to="/signup" 
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Create one here
                  </Link>
                </p>
              </div>
              <div className="text-center pt-4 border-t border-gray-200">
                <Link 
                  to="/forgot-password" 
                  className="text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors"
                >
                  Forgot your password?
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

export default Login;