import { useState, useEffect } from "react";
import { Link } from "react-router-dom"; // Removed useParams, added useSearchParams
import { useSearchParams } from "react-router-dom"; // Add this import
import useAuthStore from "../store/authStore.js";

function VerifyEmail() {
  const [searchParams] = useSearchParams(); // Get query params
  const token = searchParams.get("token"); // Extract token from ?token=...
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
        console.log("Verification response:", response); // Debug log
      } catch (error) {
        console.error("Verification error:", error); // Debug log
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Email Verification</h2>
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600">Verifying your email...</p>
          </div>
        </div>
      </div>
    );
  }

  const isSuccess =
    result?.success ||
    ["already_verified", "just_verified", "already_used"].includes(result?.status);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Email Verification</h2>

        {isSuccess ? (
          <div className="space-y-4">
            <div className="text-green-600 text-6xl mb-4">✓</div>
            <h3 className="text-xl font-semibold text-green-600">Verification Successful!</h3>
            <p className="text-gray-600">{result.message}</p>

            {result.user && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-4">
                <p className="text-green-800 text-sm">
                  <strong>Welcome {result.user.name}!</strong>
                  <br />
                  Your account is verified and ready to use.
                </p>
              </div>
            )}

            {result.status === "already_used" && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mt-4">
                <p className="text-blue-800 text-sm">
                  <strong>Good news!</strong> This verification link was already used successfully. Your account is
                  active.
                </p>
              </div>
            )}

            <Link
              to="/login"
              className="inline-block bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition duration-300 font-medium text-lg"
            >
              Go to Login →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-red-600 text-6xl mb-4">✗</div>
            <h3 className="text-xl font-semibold text-red-600">Verification Failed</h3>
            <p className="text-gray-600">{result?.message || "An unknown error occurred."}</p>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mt-4">
              <p className="text-gray-800 text-sm">
                <strong>What to try:</strong>
              </p>
              <ul className="text-gray-700 text-sm mt-2 text-left">
                <li>• Check if you have a newer verification email</li>
                <li>• Try signing up again if needed</li>
                <li>• Contact support if the issue persists</li>
              </ul>
            </div>

            <div className="space-y-2 mt-4">
              <Link
                to="/login"
                className="inline-block bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition duration-300 font-medium mr-2"
              >
                Try Login
              </Link>
              <Link
                to="/signup"
                className="inline-block bg-gray-600 text-white py-2 px-6 rounded-md hover:bg-gray-700 transition duration-300 font-medium"
              >
                Sign Up Again
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;