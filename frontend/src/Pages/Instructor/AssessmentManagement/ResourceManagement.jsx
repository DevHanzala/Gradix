import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useResourceStore from "../../../store/resourceStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import toast from "react-hot-toast";

function ResourceManagement() {
  const navigate = useNavigate();
  const { resources, loading, fetchResources, uploadResources, deleteResource, clearCurrentResource } = useResourceStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [dragActive, setDragActive] = useState(false);

  // Load resources on mount
  useEffect(() => {
    fetchResources();
    return () => clearCurrentResource();
  }, [fetchResources, clearCurrentResource]);

  // Handle resource upload
  const handleResourceUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) {
      toast.error("No files selected.");
      return;
    }
    try {
      await uploadResources(files);
      toast.success(`${files.length} resource(s) uploaded and chunked successfully.`);
      fetchResources();
    } catch (error) {
      toast.error(error.message || "Failed to upload resources.");
    }
  };

  // Handle drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // Handle drop
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    try {
      await uploadResources(files);
      toast.success(`${files.length} resource(s) uploaded and chunked successfully.`);
      fetchResources();
    } catch (error) {
      toast.error(error.message || "Failed to upload resources.");
    }
  };

  // Handle resource deletion
  const handleDeleteResource = async (resourceId) => {
    if (window.confirm("Are you sure you want to delete this resource?")) {
      try {
        await deleteResource(resourceId);
        toast.success("Resource deleted successfully.");
        fetchResources();
      } catch (error) {
        toast.error(error.message || "Failed to delete resource.");
      }
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
  };

  // Get file type icon
  const getFileIcon = (fileType) => {
    const type = fileType?.toLowerCase() || '';
    if (type.includes('pdf')) return '📕';
    if (type.includes('doc')) return '📘';
    if (type.includes('ppt') || type.includes('presentation')) return '📙';
    if (type.includes('txt') || type.includes('text')) return '📄';
    if (type.includes('image') || type.includes('jpg') || type.includes('png')) return '🖼️';
    return '📁';
  };

  // Get file type badge color
  const getFileTypeBadge = (fileType) => {
    const type = fileType?.toLowerCase() || '';
    if (type.includes('pdf')) return 'bg-red-100 text-red-700';
    if (type.includes('doc')) return 'bg-blue-100 text-blue-700';
    if (type.includes('ppt')) return 'bg-orange-100 text-orange-700';
    if (type.includes('txt')) return 'bg-gray-100 text-gray-700';
    if (type.includes('image')) return 'bg-purple-100 text-purple-700';
    return 'bg-green-100 text-green-700';
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-96">
          <LoadingSpinner type="dots" color="blue" />
          <p className="mt-4 text-gray-600 font-medium">Loading resources...</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Manage Resources</h1>
            <p className="text-gray-600">Upload and organize your educational materials</p>
          </div>
          <button
            onClick={() => navigate("/instructor/assessments")}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-white hover:border-gray-400 transition-all duration-200 font-medium shadow-sm"
          >
            ← Back to Assessments
          </button>
        </div>

        {/* Upload Section */}
        <Card className="mb-8 shadow-md border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>📤</span>
              <span>Upload New Resources</span>
            </h2>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <div className="space-y-6">
              {/* Drag and Drop Area */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-3 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all duration-300 ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                  onChange={handleResourceUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="file-upload"
                />
                <div className="pointer-events-none">
                  <div className="text-6xl mb-4">☁️</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {dragActive ? 'Drop files here' : 'Drag and drop files here'}
                  </h3>
                  <p className="text-gray-600 mb-4">or click to browse</p>
                  <label
                    htmlFor="file-upload"
                    className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold cursor-pointer shadow-md hover:shadow-lg pointer-events-auto"
                  >
                    Choose Files
                  </label>
                </div>
              </div>

              {/* Info Section */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="text-2xl flex-shrink-0">ℹ️</div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Supported Formats</p>
                    <p className="text-sm text-blue-800">
                      PDF, DOC, DOCX, TXT, PPT, PPTX, JPG, JPEG, PNG, WEBP (Max: 10MB each)
                    </p>
                    <p className="text-xs text-blue-700 mt-2">
                      📊 PDFs will be automatically chunked for efficient storage and retrieval
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resources List */}
        <Card className="shadow-md border-0">
          <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span>📚</span>
                <span>Existing Resources</span>
              </h2>
              <span className="bg-white text-red-500 bg-opacity-20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-bold">
                {resources.length} {resources.length === 1 ? 'Resource' : 'Resources'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            {resources.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-7xl mb-6">📂</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No resources yet</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Upload your first resource to start building your library for assessments
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {resources.map((resource) => (
                  <div
                    key={resource.id}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white gap-4"
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">
                        {getFileIcon(resource.file_type || resource.content_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900 truncate mb-1.5">{resource.name}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getFileTypeBadge(resource.file_type || resource.content_type)}`}>
                            {(resource.file_type || resource.content_type)?.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                            {formatFileSize(resource.file_size)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => handleDeleteResource(resource.id)}
                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-200 font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        <span>🗑️</span>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        type={modal.type}
        title={modal.title}
      >
        {modal.message}
      </Modal>
    </div>
  );
}

export default ResourceManagement;