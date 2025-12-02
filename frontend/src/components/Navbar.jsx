import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore.js";

function Navbar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Define navigation links per role - CLEAN & ACCURATE
  const getNavLinks = () => {
    if (!user) {
      return [
        { name: "Home", href: "/" },
        { name: "Login", href: "/login" },
        { name: "Sign Up", href: "/signup" },
      ];
    }

    // Base for all logged-in users
    const links = [{ name: "Profile", href: "/profile" }];

    if (user.role === "super_admin") {
      return [
        { name: "Dashboard", href: "/super-admin/dashboard" },
        ...links,
      ];
    }

    if (user.role === "admin") {
      return [
        { name: "Dashboard", href: "/admin/dashboard" },
                ...links,
      ];
    }

    if (user.role === "instructor") {
      return [
        { name: "Dashboard", href: "/instructor/dashboard" },
        { name: "My Assessments", href: "/instructor/assessments" },
        { name: "Create Assessment", href: "/instructor/assessments/create" },
        { name: "Manage Students", href: "/instructor/students" },
        { name: "Resources", href: "/instructor/resources" },
        ...links,
      ];
    }

    if (user.role === "student") {
      return [
        { name: "Dashboard", href: "/student/dashboard" },
        { name: "Analytics", href: "/student/analytics" },
        ...links,
      ];
    }

    return links;
  };

  const navLinks = getNavLinks();

  const isActiveLink = (href) => {
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleMobileMenuToggle = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const handleLogout = () => {
    logout();
    closeMobileMenu();
  };

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3" onClick={closeMobileMenu}>
              <div className="text-3xl">📚</div>
              <span className="text-xl font-bold text-blue-600">Gradewise AI</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActiveLink(link.href)
                    ? "bg-blue-100 text-blue-700 shadow-sm"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {link.name}
              </Link>
            ))}

            {/* User Info + Logout */}
            {user && (
              <div className="flex items-center space-x-4 pl-6 border-l border-gray-300 ml-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">
                    {user.role === "super_admin" ? "👑" : 
                     user.role === "admin" ? "👑" : 
                     user.role === "instructor" ? "👨‍🏫" : "🎓"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{user.role.replace("_", " ")}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={handleMobileMenuToggle}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              <span className="sr-only">Open menu</span>
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-gray-50">
            <div className="px-2 pt-2 pb-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={closeMobileMenu}
                  className={`block px-4 py-3 rounded-lg text-base font-medium transition ${
                    isActiveLink(link.href)
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {user && (
                <>
                  <div className="border-t border-gray-300 my-3"></div>
                  <div className="px-4 py-3">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="text-2xl">
                        {user.role === "super_admin" ? "👑" : 
                         user.role === "admin" ? "👑" : 
                         user.role === "instructor" ? "👨‍🏫" : "🎓"}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                        <div className="text-xs text-blue-600 capitalize mt-1">
                          {user.role.replace("_", " ")}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;