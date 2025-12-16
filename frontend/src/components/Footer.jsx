import { Link } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { FaFacebookF, FaTwitter, FaLinkedinIn, FaEnvelope, FaHeart, FaCheckCircle } from "react-icons/fa";

function Footer() {
  const { user } = useAuthStore();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 pointer-events-none"></div>
      
      <div className="relative w-full px-3 sm:px-4 lg:px-6 xl:px-7 2xl:px-8 py-8 sm:py-10 lg:py-12">
        <div className="mx-auto">
          {/* Company Info + Social Icons - Enhanced */}
          <div className="text-center md:text-left mb-7 lg:mb-9">
            <div className="flex items-center justify-center md:justify-start space-x-3 mb-6">
              <div className="text-3xl sm:text-4xl font-extrabold transform hover:scale-110 transition-transform duration-300">
                📚
              </div>
              <span className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                Gradewise AI
              </span>
            </div>

            <p className="text-gray-300 mb-4 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto md:mx-0">
              Empowering educators with intelligent grading solutions. Transform your teaching experience with
              AI-powered assessment tools that save time and enhance learning outcomes.
            </p>

            {/* Social Media Icons - Enhanced */}
            <div className="flex justify-center md:justify-start space-x-4 sm:space-x-6">
              <a
                href="#"
                className="w-11 h-11 sm:w-12 sm:h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-blue-500/50 transform hover:-translate-y-1"
                aria-label="Facebook"
              >
                <FaFacebookF className="text-lg sm:text-xl" />
              </a>
              <a
                href="#"
                className="w-11 h-11 sm:w-12 sm:h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-sky-500 hover:to-sky-600 transition-all duration-300 shadow-lg hover:shadow-sky-500/50 transform hover:-translate-y-1"
                aria-label="Twitter"
              >
                <FaTwitter className="text-lg sm:text-xl" />
              </a>
              <a
                href="#"
                className="w-11 h-11 sm:w-12 sm:h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-blue-700/50 transform hover:-translate-y-1"
                aria-label="LinkedIn"
              >
                <FaLinkedinIn className="text-lg sm:text-xl" />
              </a>
              <a
                href="mailto:support@gradewiseai.com"
                className="w-11 h-11 sm:w-12 sm:h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gradient-to-br hover:from-red-600 hover:to-red-700 transition-all duration-300 shadow-lg hover:shadow-red-500/50 transform hover:-translate-y-1"
                aria-label="Email"
              >
                <FaEnvelope className="text-lg sm:text-xl" />
              </a>
            </div>
          </div>

          {/* User Status Section - Enhanced */}
          {user && (
            <div className="border-t-2 border-gray-700/50 mt-7 sm:mt-4 pt-5 sm:pt-6">
              <div className="bg-gradient-to-br from-gray-800 via-gray-800/90 to-gray-700 rounded-2xl sm:rounded-3xl p-5 sm:p-6 lg:p-8 max-w-4xl mx-auto shadow-2xl border border-gray-700/50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 text-center sm:text-left">
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <div className="text-3xl sm:text-4xl bg-gradient-to-br from-blue-500 to-purple-500 p-3 sm:p-4 rounded-2xl shadow-lg">
                      {user.role === "super_admin" ? "👑" : 
                       user.role === "admin" ? "👑" : 
                       user.role === "instructor" ? "👨‍🏫" : "🎓"}
                    </div>
                    <div>
                      <div className="font-bold text-white text-base sm:text-lg lg:text-xl">
                        {user.name}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-300 mt-1">
                        Logged in as{" "}
                        <span className="text-blue-400 font-semibold capitalize">
                          {user.role.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/30">
                    <div className="relative flex items-center justify-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                      <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <span className="text-gray-200 font-semibold text-xs sm:text-sm">
                      Online • Active Now
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Section - Enhanced */}
          <div className="border-t-2 border-gray-700/50 mt-7 sm:mt-9 lg:mt-12 pt-7 sm:pt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left gap-3 mb-4 sm:mb-6">
              <div className="text-sm sm:text-base text-gray-400 font-medium">
                © {currentYear} Gradewise AI. All rights reserved.
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400 justify-center">
                <span className="flex items-center gap-2 font-medium">
                  Made with <FaHeart className="text-red-500 animate-pulse" /> for educators
                </span>
                <span className="hidden sm:inline text-gray-600">•</span>
                <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/30">
                  <FaCheckCircle className="text-green-500" />
                  <span className="font-semibold text-green-400">All systems operational</span>
                </div>
              </div>
            </div>

            {/* Privacy Policy Section - Enhanced */}
            <div className="bg-gray-800/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-700/50 max-w-4xl mx-auto">
              <p className="text-xs sm:text-sm text-gray-400 text-center leading-relaxed">
                This site is protected by reCAPTCHA and the Google{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300 transition-colors font-medium"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a
                  href="https://policies.google.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300 transition-colors font-medium"
                >
                  Terms of Service
                </a>{" "}
                apply.
              </p>
            </div>

            {/* Additional tagline - New */}
            <div className="text-center mt-4 sm:mt-5">
              <p className="text-xs sm:text-sm text-gray-500 italic">
                Revolutionizing education, one assessment at a time.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient decoration */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600"></div>
    </footer>
  );
}

export default Footer;