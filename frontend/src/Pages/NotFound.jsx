import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/Card.jsx"
import Navbar from "../components/Navbar.jsx"
import Footer from "../components/Footer.jsx"

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Centered Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <Card className="max-w-lg w-full shadow-lg border-0">
          <CardContent className="pt-12 pb-16 px-8 text-center">
            {/* Subtle Book Icon */}
            <div className="text-7xl mb-8 text-gray-300">📚</div>

            {/* 404 + Title */}
            <div className="mb-8">
              <h1 className="text-6xl font-bold text-gray-800 mb-2">404</h1>
              <h2 className="text-2xl font-semibold text-gray-700">Page Not Found</h2>
            </div>

            {/* Calm Description */}
            <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto mb-10">
              The page you're looking for doesn't exist or has been moved.
            </p>

            {/* Clean Buttons */}
            <div className="space-y-4 max-w-xs mx-auto">
              <Link
                to="/"
                className="block w-full bg-blue-600 text-white font-medium py-4 rounded-lg hover:bg-blue-700 transition duration-200 shadow-md"
              >
                Return to Dashboard
              </Link>

              <button
                onClick={() => window.history.back()}
                className="block w-full bg-white border border-gray-300 text-gray-700 font-medium py-4 rounded-lg hover:bg-gray-50 transition duration-200"
              >
                Go Back
              </button>
            </div>

            {/* Tiny helpful note */}
            <p className="text-sm text-gray-500 mt-10">
              Need help? Contact your instructor or admin.
            </p>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  )
}

export default NotFound