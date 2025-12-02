import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import useAuthStore from "../store/authStore.js"

function Navbar() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const getDashboardLink = () => {
    if (!user) return "/login"
    switch (user.role) {
      case "admin":
        return "/admin/assessments"
      case "instructor":
        return "/instructor/assessments"
      case "student":
        return "/student/assessments"
      default:
        return "/"
    }
  }

  const getNavLinks = () => {
    if (!user) {
      return [
        { name: "Home", href: "/" },
        { name: "Login", href: "/login" },
        { name: "Sign Up", href: "/signup" },
      ]
    }

    const baseLinks = [
      { name: "Assessments", href: getDashboardLink() },
      { name: "Profile", href: "/profile" },
    ]

    // Role-specific links
    if (user.role === "admin") {
      baseLinks.splice(1, 0, { name: "Manage Users", href: "/admin/assessments" })
    } else if (user.role === "instructor") {
      baseLinks.splice(1, 0, { name: "Manage Students", href: "/instructor/students" })
      baseLinks.splice(2, 0, { name: "My Assessments", href: "/instructor/assessments" })
    } else if (user.role === "student") {
      baseLinks.splice(1, 0, { name: "Available Assessments", href: "/student/assessments" })
    }

    return baseLinks
  }

  const isActiveLink = (href) => {
    return location.pathname === href
  }

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  const handleLogout = () => {
    logout()
    closeMobileMenu()
  }

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-3 lg:px-6 xl:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2" onClick={closeMobileMenu}>
              <div className="text-2xl">📚</div>
              <span className="text-xl font-bold text-blue-600">Gradewise AI</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {getNavLinks().map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition duration-200 ${
                  isActiveLink(link.href)
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {link.name}
              </Link>
            ))}

            {/* User Info & Logout */}
            {user && (
              <div className="flex items-center space-x-4 pl-4 border-l border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="text-lg">
                    {user.role === "admin" ? "👑" : user.role === "instructor" ? "📝" : "👨‍🎓"}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-gray-500 capitalize">{user.role}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition duration-200"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={handleMobileMenuToggle}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition duration-200"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              <svg
                className={`${isMobileMenuOpen ? "hidden" : "block"} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {/* Close icon */}
              <svg
                className={`${isMobileMenuOpen ? "block" : "hidden"} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`md:hidden ${isMobileMenuOpen ? "block" : "hidden"}`}>
          <div className="px-2 pt-2 pb-3 space-y-1 bg-gray-50 border-t border-gray-200">
            {getNavLinks().map((link) => (
              <Link
                key={link.name}
                to={link.href}
                onClick={closeMobileMenu}
                className={`block px-3 py-2 rounded-md text-base font-medium transition duration-200 ${
                  isActiveLink(link.href)
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {link.name}
              </Link>
            ))}

            {/* Mobile User Info */}
            {user && (
              <div className="pt-4 pb-3 border-t border-gray-200">
                <div className="flex items-center px-3 mb-3">
                  <div className="text-2xl mr-3">
                    {user.role === "admin" ? "👑" : user.role === "instructor" ? "📝" : "👨‍🎓"}
                  </div>
                  <div>
                    <div className="text-base font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-sm text-blue-600 capitalize">{user.role}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-900 hover:bg-red-50 transition duration-200"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
