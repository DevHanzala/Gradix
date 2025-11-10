import { Link } from "react-router-dom"
import { Card, CardContent } from "../components/ui/Card.jsx"
import Navbar from "../components/Navbar.jsx"
import Footer from "../components/Footer.jsx"

function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Navbar />

      <div className="flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent>
            <div className="text-8xl mb-6">🔍</div>
            <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
            <p className="text-gray-600 mb-8">
              Oops! The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the
              wrong URL.
            </p>
            <div className="space-y-4">
              <Link
                to="/"
                className="block w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition duration-200 font-medium"
              >
                Go Home
              </Link>
              <button
                onClick={() => window.history.back()}
                className="block w-full bg-gray-100 text-gray-800 py-3 px-6 rounded-md hover:bg-gray-200 transition duration-200 font-medium"
              >
                Go Back
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  )
}

export default NotFound
