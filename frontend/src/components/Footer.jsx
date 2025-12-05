import { Link } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { FaFacebookF, FaTwitter, FaLinkedinIn, FaEnvelope } from "react-icons/fa";

function Footer() {
  const { user } = useAuthStore();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="w-full px-4 sm:px-4 lg:px-6 xl:px-8 2xl:px-10 py-12">
        <div className=" mx-auto">
          {/* Company Info + Social Icons Only */}
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-3 mb-6">
              <div className="text-3xl font-extrabold">📚</div>
              <span className="text-3xl font-bold text-blue-400">Gradewise AI</span>
            </div>

            <p className="text-gray-400 mb-8 text-sm leading-relaxed max-w-2xl mx-auto md:mx-0">
              Empowering educators with intelligent grading solutions. Transform your teaching experience with
              AI-powered assessment tools.
            </p>

            {/* Social Media Icons with Font Awesome */}
            <div className="flex justify-center md:justify-start space-x-6">
              <a
                href="#"
                className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-blue-600 transition duration-300"
                aria-label="Facebook"
              >
                <FaFacebookF className="text-xl" />
              </a>
              <a
                href="#"
                className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-sky-500 transition duration-300"
                aria-label="Twitter"
              >
                <FaTwitter className="text-xl" />
              </a>
              <a
                href="#"
                className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-blue-700 transition duration-300"
                aria-label="LinkedIn"
              >
                <FaLinkedinIn className="text-xl" />
              </a>
              <a
                href="mailto:support@gradewiseai.com"
                className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 transition duration-300"
                aria-label="Email"
              >
                <FaEnvelope className="text-xl" />
              </a>
            </div>
          </div>

          {/* User Status Section (unchanged) */}
          {user && (
            <div className="border-t border-gray-800 mt-8 pt-8">
              <div className="bg-gray-800 rounded-lg p-6 max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div className="flex items-center space-x-4">
                    <div className="text-3xl">
                      {user.role === "admin" ? "👑" : user.role === "instructor" ? "👨‍🏫" : "🎓"}
                    </div>
                    <div>
                      <div className="font-bold text-white text-lg">{user.name}</div>
                      <div className="text-sm text-gray-300">
                        Logged in as{" "}
                        <span className="text-blue-400 font-medium capitalize">
                          {user.role.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <span className="text-gray-300 font-medium">Online • Active Now</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Section */}
          <div className="border-t border-gray-800 mt-18 pt-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between text-center md:text-left">
              <div className="text-sm text-gray-400 mb-4 md:mb-0">
                © {currentYear} Gradewise AI. All rights reserved.
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 text-xs text-gray-400 justify-center">
                <span>Made with love for educators</span>
                <span className="hidden sm:inline">•</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>System Status: All systems operational</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-8 text-center max-w-4xl mx-auto leading-relaxed">
              This site is protected by reCAPTCHA and the Google{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-300"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-300"
              >
                Terms of Service
              </a>{" "}
              apply.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;