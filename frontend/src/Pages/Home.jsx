import { Link } from "react-router-dom"
import useAuthStore from "../store/authStore.js"
import { Card, CardContent } from "../components/ui/Card.jsx"
import Navbar from "../components/Navbar.jsx"
import Footer from "../components/Footer.jsx"

function Home() {
  const { user } = useAuthStore()

  const getDashboardLink = () => {
    if (!user) return "/login"
    switch (user.role) {
      case "admin":
        return "/admin/dashboard"
      case "instructor":
        return "/instructor/dashboard"
      case "student":
        return "/student/dashboard"
      default:
        return "/"
    }
  }

  const features = [
    {
      icon: "🤖",
      title: "AI-Powered Grading",
      description: "Intelligent automated grading system that understands context and provides detailed feedback.",
    },
    {
      icon: "📊",
      title: "Analytics Dashboard",
      description: "Comprehensive insights into student performance and learning patterns.",
    },
    {
      icon: "👥",
      title: "Multi-Role Support",
      description: "Seamless experience for administrators, instructors, and students.",
    },
    {
      icon: "🔒",
      title: "Secure & Reliable",
      description: "Enterprise-grade security with role-based access control.",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <Navbar />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Welcome to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Gradewise AI
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Your intelligent grading assistant that revolutionizes the way educators assess and provide feedback to
              students.
            </p>

            {user ? (
              <div className="space-y-4">
                <Card className="max-w-md mx-auto">
                  <CardContent className="text-center">
                    <div className="text-4xl mb-4">👋</div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Hello, {user.name}!</h3>
                    <p className="text-gray-600 mb-4">
                      You are logged in as <span className="font-semibold capitalize text-blue-600">{user.role}</span>
                    </p>
                    <div className="space-y-3">
                      <Link
                        to={getDashboardLink()}
                        className="block w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition duration-200 font-medium"
                      >
                        Go to Dashboard
                      </Link>
                      <Link
                        to="/profile"
                        className="block w-full bg-gray-100 text-gray-800 py-3 px-6 rounded-md hover:bg-gray-200 transition duration-200 font-medium"
                      >
                        View Profile
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/login"
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg hover:bg-blue-700 transition duration-200 font-semibold text-lg"
                >
                  Get Started
                </Link>
                <Link
                  to="/signup"
                  className="bg-white text-blue-600 px-8 py-4 rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition duration-200 font-semibold text-lg"
                >
                  Sign Up Free
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 -mt-4 opacity-10">
          <div className="text-9xl">🎓</div>
        </div>
        <div className="absolute bottom-0 left-0 -mb-4 opacity-10">
          <div className="text-9xl">📝</div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why Choose Gradewise AI?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover the features that make Gradewise AI the perfect solution for modern education.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} hover className="text-center">
                <CardContent>
                  <div className="text-4xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Grading Experience?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of educators who are already using Gradewise AI to enhance their teaching.
          </p>
          {!user && (
            <Link
              to="/signup"
              className="bg-white text-blue-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition duration-200 font-semibold text-lg inline-block"
            >
              Start Your Free Trial
            </Link>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default Home
