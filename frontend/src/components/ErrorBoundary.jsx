import { Component } from "react";
import { FaExclamationTriangle, FaSync, FaHome } from "react-icons/fa";

class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
          <div className="text-center p-6 sm:p-8 lg:p-10 bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full border-2 border-red-200">
            {/* Error Icon */}
            <div className="bg-gradient-to-br from-red-100 to-orange-100 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <FaExclamationTriangle className="text-4xl sm:text-5xl text-red-600 animate-pulse" />
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-red-600 mb-4">
              Oops! Something went wrong
            </h2>

            {/* Description */}
            <p className="text-gray-600 text-sm sm:text-base mb-6 leading-relaxed">
              We're sorry for the inconvenience. An unexpected error occurred. 
              Please try refreshing the page or return to the homepage.
            </p>

            {/* Error Details Box */}
            <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs sm:text-sm text-gray-700 font-mono break-words">
                <strong className="text-red-600">Error:</strong> {this.state.error?.message || "Unknown error"}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                onClick={this.handleRefresh}
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base sm:text-lg font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <FaSync />
                <span>Refresh Page</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-white border-2 border-gray-300 text-gray-700 text-base sm:text-lg font-bold rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <FaHome />
                <span>Go Home</span>
              </button>
            </div>

            {/* Additional Help */}
            <div className="mt-8 pt-6 border-t-2 border-gray-200">
              <p className="text-xs sm:text-sm text-gray-500">
                If this problem persists, please contact support or try again later.
              </p>
            </div>

            {/* Technical Details (Collapsible - Optional) */}
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors">
                  🔍 Show Technical Details (Dev Mode)
                </summary>
                <div className="mt-3 bg-gray-900 text-gray-100 rounded-lg p-4 overflow-auto max-h-48 text-xs font-mono">
                  <pre className="whitespace-pre-wrap break-words">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;