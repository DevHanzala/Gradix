import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import Navbar from "../components/Navbar.jsx";
import Footer from "../components/Footer.jsx";
import LoadingSpinner from "../components/ui/LoadingSpinner.jsx";
import { FaCheckCircle, FaTimesCircle, FaEnvelope, FaArrowRight } from "react-icons/fa";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const verifyEmail = useAuthStore((state) => state.verifyEmail);

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const handleVerification = async () => {
      if (!token) {
        setResult({
          success: false,
          message: "Invalid verification link - no token provided.",
          status: "no_token",
        });
        setLoading(false);
        return;
      }

      try {
        const response = await verifyEmail(token);
        setResult(response);
        console.log("Verification response:", response);
      } catch (error) {
        console.error("Verification error:", error);
        if (error.response && error.response.data) {
          setResult(error.response.data);
        } else {
          setResult({
            success: false,
            message: `An unexpected error occurred during verification: ${error.message}`,
            status: "network_error",
          });
        }
      } finally {
        setLoading(false);
      }
    };

    handleVerification();
  }, [token, verifyEmail]);

  const isSuccess =
    result?.success ||
    ["already_verified", "just_verified", "already_used"].includes(result?.status);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white p-8 sm:p-10 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md text-center border-2 border-gray-200">
            <div className="bg-gradient-to-br from-blue-100 to-purple-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaEnvelope className="text-4xl sm:text-5xl text-blue-600" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Email Verification</h2>
            <div className="space-y-4">
              <LoadingSpinner size="lg" color="blue" type="dots" />
              <p className="text-gray-600 font-semibold">Verifying your email...</p>
              <p className="text-sm text-gray-500">Please wait a moment</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white p-8 sm:p-10 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md text-center border-2 border-gray-200">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-8">Email Verification</h2>

          {isSuccess ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-green-100 to-emerald-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <FaCheckCircle className="text-5xl sm:text-6xl text-green-600 animate-bounce" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-green-600">Verification Successful!</h3>
              <p className="text-gray-600 leading-relaxed">{result.message}</p>

              {result.user && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 sm:p-5">
                  <p className="text-green-800 text-sm sm:text-base">
                    <strong className="text-lg">Welcome {result.user.name}! 🎉</strong>
                    <br />
                    Your account is verified and ready to use.
                  </p>
                </div>
              )}

              {result.status === "already_used" && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 sm:p-5">
                  <p className="text-blue-800 text-sm sm:text-base">
                    <strong>✨ Good news!</strong> This verification link was already used successfully. Your account is active.
                  </p>
                </div>
              )}

              <Link
                to="/login"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 font-bold text-base sm:text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <span>Go to Login</span>
                <FaArrowRight />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-red-100 to-pink-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <FaTimesCircle className="text-5xl sm:text-6xl text-red-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-red-600">Verification Failed</h3>
              <p className="text-gray-600 leading-relaxed">{result?.message || "An unknown error occurred."}</p>

              <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-gray-200 rounded-xl p-4 sm:p-5 text-left">
                <p className="text-gray-800 text-sm font-bold mb-3">
                  🔧 What to try:
                </p>
                <ul className="text-gray-700 text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Check if you have a newer verification email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Try signing up again if needed</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Contact support if the issue persists</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-bold shadow-lg"
                >
                  Try Login
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 px-6 rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-200 font-bold shadow-lg"
                >
                  Sign Up Again
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default VerifyEmail;