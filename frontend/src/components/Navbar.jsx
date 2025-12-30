import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore.js";
import { 
  FaHome, 
  FaUser, 
  FaChartBar, 
  FaClipboardList, 
  FaPlus, 
  FaUserGraduate, 
  FaBook,
  FaTachometerAlt 
} from "react-icons/fa";

function Navbar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Define navigation links per role with icons
  const getNavLinks = () => {
    if (!user) {
      return [
        { name: "Home", href: "/", icon: <FaHome className="w-4 h-4" /> },
        { name: "Login", href: "/login", icon: <FaUser className="w-4 h-4" /> },
        { name: "Sign Up", href: "/signup", icon: <FaUserGraduate className="w-4 h-4" /> },
      ];
    }

    // Base for all logged-in users
    const links = [{ name: "Profile", href: "/profile", icon: <FaUser className="w-4 h-4" /> }];

    if (user.role === "super_admin") {
      return [
        { name: "Dashboard", href: "/super-admin/dashboard", icon: <FaTachometerAlt className="w-4 h-4" /> },
        ...links,
      ];
    }

    if (user.role === "admin") {
      return [
        { name: "Dashboard", href: "/admin/dashboard", icon: <FaTachometerAlt className="w-4 h-4" /> },
        ...links,
      ];
    }

    if (user.role === "instructor") {
      return [
        { name: "Dashboard", href: "/instructor/dashboard", icon: <FaTachometerAlt className="w-4 h-4" /> },
        { name: "My Assessments", href: "/instructor/assessments", icon: <FaClipboardList className="w-4 h-4" /> },
        { name: "Create Assessment", href: "/instructor/assessments/create", icon: <FaPlus className="w-4 h-4" /> },
        { name: "Manage Students", href: "/instructor/students", icon: <FaUserGraduate className="w-4 h-4" /> },
        { name: "Resources", href: "/instructor/resources", icon: <FaBook className="w-4 h-4" /> },
        ...links,
      ];
    }

    if (user.role === "student") {
      return [
        { name: "Dashboard", href: "/student/dashboard", icon: <FaTachometerAlt className="w-4 h-4" /> },
        { name: "Analytics", href: "/student/analytics", icon: <FaChartBar className="w-4 h-4" /> },
        ...links,
      ];
    }

    return links;
  };

  const navLinks = getNavLinks();

const isActiveLink = (href) => {
  const currentPath = location.pathname;

  // Exact match
  if (currentPath === href) return true;

  // Special case: My Assessments should NOT be active when on Create page
  if (href === "/instructor/assessments" && currentPath === "/instructor/assessments/create") {
    return false;
  }

  // Parent active if current path starts with href + "/"
  return currentPath.startsWith(href + "/");
};

  const handleMobileMenuToggle = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const handleLogout = () => {
    logout();
    closeMobileMenu();
  };

  return (
    <nav className=" shadow-xl border-b-2 border-gray-200 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
      <div className="w-full px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo Section - Enhanced */}
          <div className="flex items-center flex-shrink-0">
            <Link 
              to="/" 
              className="flex items-center space-x-2 group" 
              onClick={closeMobileMenu}
            >
              <div className="text-2xl sm:text-3xl transform group-hover:scale-110 transition-transform duration-300">
                📚
              </div>
              <span className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent whitespace-nowrap">
                Gradewise AI
              </span>
            </Link>
          </div>

          {/* Desktop Navigation - Enhanced & Compact */}
          <div className="hidden lg:flex items-center space-x-1 flex-1 justify-end">
            <div className="flex items-center space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                    isActiveLink(link.href)
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      : "text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {link.icon}
                  <span className="hidden xl:inline">{link.name}</span>
                </Link>
              ))}
            </div>

            {/* User Info + Logout - Compact */}
            {user && (
              <div className="flex items-center space-x-1 pl-2 ml-1 border-l-2 border-gray-300">
                <div className="flex items-center space-x-1 bg-gradient-to-r from-blue-50 to-purple-50 px-2 py-1 rounded-lg border border-blue-200">
                  <div className="text-lg">
                    {user.role === "super_admin" ? "👑" : 
                     user.role === "admin" ? "👑" : 
                     user.role === "instructor" ? "👨‍🏫" : "🎓"}
                  </div>
                  <div className="hidden xl:block">
                    <div className="text-xs font-bold text-gray-900 leading-tight">{user.name}</div>
                    <div className="text-xs text-blue-600 capitalize font-medium leading-tight">
                      {user.role.replace("_", " ")}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-gradient-to-r from-red-600 to-red-700 text-white px-2 py-1.5 rounded-lg text-sm font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-lg hover:shadow-xl whitespace-nowrap"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button - Enhanced */}
          <div className="lg:hidden">
            <button
              onClick={handleMobileMenuToggle}
              className="p-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300"
            >
              <span className="sr-only">Open menu</span>
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu - Enhanced */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t-2 border-gray-200 bg-gradient-to-br from-gray-50 to-blue-50/30 shadow-inner">
            <div className="px-2 pt-3 pb-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={closeMobileMenu}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-300 ${
                    isActiveLink(link.href)
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      : "text-gray-700 hover:bg-white hover:shadow-md hover:text-blue-600"
                  }`}
                >
                  <span className={isActiveLink(link.href) ? "text-white" : "text-blue-600"}>
                    {link.icon}
                  </span>
                  <span>{link.name}</span>
                </Link>
              ))}

              {user && (
                <>
                  <div className="border-t-2 border-gray-300 my-3"></div>
                  <div className="px-2">
                    {/* User Info Card - Enhanced */}
                    <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl p-4 mb-3 border-2 border-blue-200 shadow-md">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="text-3xl bg-white p-2 rounded-xl shadow-sm">
                          {user.role === "super_admin" ? "👑" : 
                           user.role === "admin" ? "👑" : 
                           user.role === "instructor" ? "👨‍🏫" : "🎓"}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-lg">{user.name}</div>
                          <div className="text-sm text-gray-700">{user.email}</div>
                          <div className="inline-flex items-center gap-1 text-xs text-white bg-blue-600 px-2 py-1 rounded-full capitalize mt-1 font-semibold">
                            {user.role.replace("_", " ")}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Logout Button - Enhanced */}
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
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