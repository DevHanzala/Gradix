import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/Card.jsx"
import Navbar from "../components/Navbar.jsx"
import Footer from "../components/Footer.jsx"
import { FaHome, FaArrowLeft, FaQuestionCircle } from "react-icons/fa"

function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex flex-col">
      <Navbar />

      {/* Centered Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <Card className="max-w-lg w-full shadow-2xl border-2 border-gray-200 rounded-2xl sm:rounded-3xl overflow-hidden">
          <CardContent className="pt-10 sm:pt-12 pb-12 sm:pb-16 px-6 sm:px-8 text-center">
            {/* Animated Book Icon with Gradient Background */}
            <div className="relative mb-8">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center mx-auto shadow-lg">
                <div className="text-6xl sm:text-7xl animate-bounce">📚</div>
              </div>
            </div>

            {/* 404 + Title - Enhanced */}
            <div className="mb-8">
              <h1 className="text-7xl sm:text-8xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
                404
              </h1>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Page Not Found</h2>
              <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto rounded-full"></div>
            </div>

            {/* Description - Enhanced */}
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-md mx-auto mb-10">
              Oops! The page you're looking for doesn't exist or has been moved to a different location.
            </p>

            {/* Action Buttons - Enhanced */}
            <div className="space-y-3 sm:space-y-4 max-w-xs mx-auto">
              <Link
                to="/"
                className="group flex items-center justify-center gap-3 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 sm:py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <FaHome className="group-hover:scale-110 transition-transform" />
                <span>Return to Dashboard</span>
              </Link>

              <button
                onClick={() => window.history.back()}
                className="group flex items-center justify-center gap-3 w-full bg-white border-2 border-gray-300 text-gray-700 font-bold py-3 sm:py-4 px-6 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                <span>Go Back</span>
              </button>
            </div>

            {/* Help Section - Enhanced */}
            <div className="mt-10 pt-6 border-t-2 border-gray-200">
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg">
                <FaQuestionCircle />
                <p className="text-sm font-semibold">
                  Need help? Contact your instructor or admin.
                </p>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6">
              <p className="text-xs text-gray-500">
                Error Code: 404 | Page Not Found
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  )
}

export default NotFound