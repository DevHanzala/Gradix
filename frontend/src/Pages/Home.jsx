import { Link } from "react-router-dom"
import useAuthStore from "../store/authStore.js"
import { Card, CardContent } from "../components/ui/Card.jsx"
import Navbar from "../components/Navbar.jsx"
import Footer from "../components/Footer.jsx"
import { 
  FaRocket, 
  FaChartLine, 
  FaUsers, 
  FaShieldAlt, 
  FaArrowRight,
  FaStar,
  FaCheckCircle,
  FaBolt,
  FaTachometerAlt,
  FaUserCircle
} from "react-icons/fa"

function Home() {
  const { user } = useAuthStore()

  const getDashboardLink = () => {
    if (!user) return "/login"
    switch (user.role) {
      case "super_admin":
        return "/super-admin/dashboard"
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
      iconComponent: <FaBolt className="w-6 h-6" />,
      title: "AI-Powered Grading",
      description: "Intelligent automated grading system that understands context and provides detailed feedback.",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    {
      icon: "📊",
      iconComponent: <FaChartLine className="w-6 h-6" />,
      title: "Analytics Dashboard",
      description: "Comprehensive insights into student performance and learning patterns.",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200"
    },
    {
      icon: "👥",
      iconComponent: <FaUsers className="w-6 h-6" />,
      title: "Multi-Role Support",
      description: "Seamless experience for administrators, instructors, and students.",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    },
    {
      icon: "🔒",
      iconComponent: <FaShieldAlt className="w-6 h-6" />,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with role-based access control.",
      color: "from-orange-500 to-red-500",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200"
    },
  ]

  const benefits = [
    { text: "Save 10+ hours per week on grading", icon: <FaCheckCircle className="text-green-500" /> },
    { text: "Instant feedback for students", icon: <FaCheckCircle className="text-green-500" /> },
    { text: "Detailed analytics and insights", icon: <FaCheckCircle className="text-green-500" /> },
    { text: "Easy to use interface", icon: <FaCheckCircle className="text-green-500" /> },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 overflow-hidden">
      <Navbar />

      {/* Hero Section - Enhanced */}
      <div className="relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-20 left-40 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative w-full mx-auto px-3 sm:px-4 lg:px-7 py-11 sm:py-12 lg:py-16">
          <div className="text-center">

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-gray-900 mb-4 sm:mb-6 leading-tight px-2">
              Welcome to{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 animate-gradient">
                Gradewise AI
              </span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 mb-6 sm:mb-8 lg:mb-10 max-w-4xl mx-auto leading-relaxed px-4">
              Your intelligent grading assistant that revolutionizes the way educators assess and provide feedback to
              students with <span className="font-bold text-blue-600">AI-powered precision</span>.
            </p>

            {/* Benefits List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl mx-auto mb-8 sm:mb-10 px-4">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-4 py-3 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="text-xl sm:text-2xl">{benefit.icon}</div>
                  <span className="text-sm sm:text-base text-gray-700 font-medium text-left">{benefit.text}</span>
                </div>
              ))}
            </div>

            {user ? (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <Card className="max-w-xl mx-auto shadow-2xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
                  <CardContent className="text-center p-6 sm:p-8 lg:p-10">
                    <div className="bg-gradient-to-br from-blue-600 to-purple-600 w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-4 sm:mb-6 shadow-lg">
                      {user.role === "super_admin" ? "👑" : 
                       user.role === "admin" ? "👑" : 
                       user.role === "instructor" ? "👨‍🏫" : "🎓"}
                    </div>
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">Hello, {user.name}! 👋</h3>
                    <p className="text-sm sm:text-base lg:text-lg text-gray-600 mb-6 sm:mb-8">
                      You are logged in as <span className="font-bold capitalize bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{user.role.replace("_", " ")}</span>
                    </p>
                    <div className="space-y-3 sm:space-y-4">
                      <Link
                        to={getDashboardLink()}
                        className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 sm:py-4 px-6 sm:px-8 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-bold text-base sm:text-lg shadow-lg hover:shadow-2xl transform hover:-translate-y-1"
                      >
                        <FaTachometerAlt />
                        Go to Dashboard
                        <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
                      </Link>
                      <Link
                        to="/profile"
                        className="flex items-center justify-center gap-2 w-full bg-white text-gray-800 py-3 sm:py-4 px-6 sm:px-8 rounded-xl hover:bg-gray-50 transition-all duration-300 font-semibold text-base sm:text-lg shadow-md hover:shadow-lg border-2 border-gray-200 transform hover:-translate-y-0.5"
                      >
                        <FaUserCircle />
                        View Profile
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center px-4 animate-fade-in">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 sm:px-10 py-3 sm:py-5 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-bold text-base sm:text-lg lg:text-xl shadow-2xl hover:shadow-blue-500/50 transform hover:-translate-y-1 w-full sm:w-auto"
                >
                  <FaRocket />
                  Get Started
                  <FaArrowRight />
                </Link>
                <Link
                  to="/signup"
                  className="flex items-center justify-center gap-2 bg-white text-blue-600 px-6 sm:px-10 py-3 sm:py-5 rounded-xl border-2 border-blue-600 hover:bg-blue-50 transition-all duration-300 font-bold text-base sm:text-lg lg:text-xl shadow-xl hover:shadow-2xl transform hover:-translate-y-1 w-full sm:w-auto"
                >
                  <FaUsers />
                  Sign Up Free
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Floating decorative elements */}
        <div className="absolute top-10 sm:top-20 right-4 sm:right-10 text-4xl sm:text-6xl lg:text-9xl opacity-10 animate-float">
          🎓
        </div>
        <div className="absolute bottom-10 sm:bottom-20 left-4 sm:left-10 text-4xl sm:text-6xl lg:text-9xl opacity-10 animate-float animation-delay-2000">
          📝
        </div>
      </div>

      {/* Features Section - Enhanced */}
      <div className="py-16 sm:py-20 lg:py-28 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-semibold text-blue-700 mb-4 sm:mb-6">
              <FaStar className="text-yellow-500" />
              Features That Matter
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6 px-4">
              Why Choose Gradewise AI?
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4">
              Discover the features that make Gradewise AI the perfect solution for modern education.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className={`text-center group hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border-2 ${feature.borderColor} ${feature.bgColor}`}
              >
                <CardContent className="p-6 sm:p-8">
                  <div className={`bg-gradient-to-br ${feature.color} w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl mx-auto mb-4 sm:mb-6 shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

   

      {/* CTA Section - Enhanced */}
      <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 py-16 sm:py-20 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-40"></div>
        <div className="relative max-w-5xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-semibold text-white mb-6 sm:mb-8">
            <FaBolt className="text-yellow-300" />
            Start Your Journey Today
          </div>
          
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 sm:mb-6 leading-tight px-4">
            Ready to Transform Your Grading Experience?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-blue-100 mb-8 sm:mb-10 lg:mb-12 max-w-3xl mx-auto leading-relaxed px-4">
            Join thousands of educators who are already using Gradewise AI to enhance their teaching and save valuable time.
          </p>
          {!user && (
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-3 bg-white text-blue-600 px-8 sm:px-12 py-4 sm:py-5 rounded-xl hover:bg-gray-100 transition-all duration-300 font-bold text-base sm:text-lg lg:text-xl shadow-2xl hover:shadow-white/30 transform hover:-translate-y-1"
            >
              <FaRocket />
              Start Your Free Trial
              <FaArrowRight />
            </Link>
          )}
        </div>
      </div>

      <Footer />
      
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-gradient { 
          background-size: 200% auto;
          animation: gradient 3s linear infinite;
        }
        .animate-fade-in { animation: fade-in 0.6s ease-out; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  )
}

export default Home