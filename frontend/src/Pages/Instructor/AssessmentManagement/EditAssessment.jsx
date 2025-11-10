import  { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import useResourceStore from "../../../store/resourceStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import toast from "react-hot-toast";

function EditAssessment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentAssessment, loading, error, getAssessmentById, updateAssessment } = useAssessmentStore();
  const { resources, fetchResources, loading: resourcesLoading } = useResourceStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });

  const [formData, setFormData] = useState({
    title: "",
    prompt: "",
    externalLinks: [],
  });

  const [questionBlocks, setQuestionBlocks] = useState([
    {
      question_type: "multiple_choice",
      question_count: 1,
    },
  ]);

  const [selectedResources, setSelectedResources] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  useEffect(() => {
    console.log(`🔍 EditAssessment: id from useParams = "${id}", pathname = "${location.pathname}"`);
    const fetchData = async () => {
      try {
        if (!id || isNaN(parseInt(id))) {
          console.warn(`⚠️ Invalid assessment ID: "${id}" at ${location.pathname}`);
          setModal({
            isOpen: true,
            type: "error",
            title: "Invalid Assessment",
            message: "The assessment ID is invalid. Redirecting to assessments list.",
          });
          toast.error("Invalid assessment ID");
          navigate("/instructor/assessments");
          return;
        }
        await fetchResources();
        await getAssessmentById(parseInt(id));
      } catch (err) {
        console.error("❌ Error fetching assessment or resources:", err);
        const errorMessage = err.response?.data?.message || err.message || "Failed to fetch assessment or resources";
        setModal({ isOpen: true, type: "error", title: "Error", message: errorMessage });
        toast.error(errorMessage);
        if (err.response?.status === 403 || err.message === "No authentication token found") {
          setTimeout(() => navigate("/login"), 2000);
        } else if (err.response?.status === 404 || err.message === "Invalid assessment ID") {
          navigate("/instructor/assessments");
        }
      }
    };
    fetchData();
  }, [id, getAssessmentById, fetchResources, navigate, location.pathname]);

  useEffect(() => {
    if (currentAssessment) {
      setFormData({
        title: currentAssessment.title || "",
        prompt: currentAssessment.prompt || "",
        externalLinks: Array.isArray(currentAssessment.external_links) ? currentAssessment.external_links : [],
      });
      setQuestionBlocks(
        Array.isArray(currentAssessment.question_blocks) && currentAssessment.question_blocks.length > 0
          ? currentAssessment.question_blocks.map(block => ({
              question_type: block.question_type || "multiple_choice",
              question_count: Number(block.question_count) || 1,
            }))
          : [{ question_type: "multiple_choice", question_count: 1 }]
      );
      setSelectedResources(
        Array.isArray(currentAssessment.resources)
          ? currentAssessment.resources.map(r => r.id).filter(id => id && !isNaN(id))
          : []
      );
      console.log(`🔍 Loaded selectedResources:`, currentAssessment.resources?.map(r => r.id));
    }
  }, [currentAssessment]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBlockChange = (index, field, value) => {
    setQuestionBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, [field]: field === "question_count" ? Number.parseInt(value) : value } : block))
    );
  };

  const addQuestionBlock = () => {
    setQuestionBlocks((prev) => [
      ...prev,
      {
        question_type: "multiple_choice",
        question_count: 1,
      },
    ]);
  };

  const removeQuestionBlock = (index) => {
    if (questionBlocks.length > 1) {
      setQuestionBlocks((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const addExternalLink = () => {
    setFormData((prev) => ({
      ...prev,
      externalLinks: [...prev.externalLinks, ""],
    }));
  };

  const removeExternalLink = (index) => {
    setFormData((prev) => ({
      ...prev,
      externalLinks: prev.externalLinks.filter((_, i) => i !== index),
    }));
  };

  const handleExternalLinkChange = (index, value) => {
    setFormData((prev) => ({
      ...prev,
      externalLinks: prev.externalLinks.map((link, i) => (i === index ? value : link)),
    }));
  };

  const handleResourceSelection = (resourceId) => {
    if (!resourceId || isNaN(resourceId)) return;
    setSelectedResources((prev) =>
      prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]
    );
  };

  const handleNewFiles = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles((prev) => [...prev, ...files]);
  };

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      showModal("error", "Validation Error", "Assessment title is required.");
      return;
    }

    if (!formData.prompt.trim()) {
      showModal("error", "Validation Error", "AI prompt is required.");
      return;
    }

    if (questionBlocks.length === 0 || questionBlocks.some((block) => block.question_count < 1 || !block.question_type)) {
      showModal("error", "Validation Error", "At least one valid question block with a valid type and count is required.");
      return;
    }

    if (currentAssessment?.is_executed) {
      showModal("error", "Error", "Cannot edit an executed assessment.");
      return;
    }

    const validExternalLinks = formData.externalLinks.filter(link => link.trim() !== "");
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;
    const invalidLinks = validExternalLinks.filter(link => !urlPattern.test(link));
    if (invalidLinks.length > 0) {
      showModal("error", "Validation Error", `Invalid URLs: ${invalidLinks.join(", ")}`);
      return;
    }

    const validSelectedResources = selectedResources.filter(id => id && !isNaN(id));
    console.log("📝 Submitting selectedResources:", validSelectedResources);

    try {
      const assessmentData = {
        title: formData.title,
        prompt: formData.prompt,
        externalLinks: validExternalLinks,
        question_blocks: questionBlocks,
        selected_resources: validSelectedResources,
        new_files: newFiles,
      };

      console.log("📝 Submitting updated assessment data:", assessmentData);

      const updatedAssessment = await updateAssessment(parseInt(id), assessmentData);

      if (updatedAssessment) {
        showModal("success", "Success", "Assessment updated successfully! Redirecting to assessment detail...");
        setTimeout(() => {
          navigate(`/instructor/assessments/${id}`);
        }, 2000);
      }
    } catch (error) {
      console.error("❌ Failed to update assessment:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to update assessment.";
      showModal("error", "Error", errorMessage);
    }
  };

  if (loading || !currentAssessment) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Loading assessment details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/instructor/assessments")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md"
          >
            Back to Assessments
          </button>
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Assessment</h1>
          <p className="text-gray-600">Update the details for {currentAssessment.title}.</p>
          {currentAssessment.is_executed && (
            <p className="text-red-600 mt-2">This assessment is executed and cannot be edited.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Assessment Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter assessment title"
                  required
                  disabled={currentAssessment.is_executed}
                />
              </div>

              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                  AI Prompt *
                </label>
                <textarea
                  id="prompt"
                  name="prompt"
                  value={formData.prompt}
                  onChange={handleInputChange}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the prompt for AI to generate questions"
                  required
                  disabled={currentAssessment.is_executed}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  External Links
                </label>
                <div className="space-y-2">
                  {formData.externalLinks.map((link, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="url"
                        placeholder="https://example.com/resource"
                        value={link || ""}
                        onChange={(e) => handleExternalLinkChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      />
                      <button
                        type="button"
                        onClick={() => removeExternalLink(index)}
                        className="px-3 py-2 text-red-600 hover:text-red-800"
                        disabled={currentAssessment.is_executed}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addExternalLink}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                    disabled={currentAssessment.is_executed}
                  >
                    + Add Another Link
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Existing Resources
                </label>
                {resourcesLoading ? (
                  <LoadingSpinner />
                ) : resources.length === 0 ? (
                  <p className="text-gray-600">No existing resources available.</p>
                ) : (
                  <div className="space-y-2">
                    {resources.map((resource) => (
                      <div key={resource.id} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`resource-${resource.id}`}
                          checked={selectedResources.includes(resource.id)}
                          onChange={() => handleResourceSelection(resource.id)}
                          className="mr-2"
                          disabled={currentAssessment.is_executed}
                        />
                        <label htmlFor={`resource-${resource.id}`}>{resource.name} ({resource.file_type})</label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload New Documents (PDF, PPT, TXT, DOC, etc.)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.ppt,.pptx,.txt,.doc,.docx"
                  onChange={handleNewFiles}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={currentAssessment.is_executed}
                />
                <p className="text-xs text-gray-500 mt-1">
                  New uploads will be chunked and stored efficiently.
                </p>
                {newFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {newFiles.map((file, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeNewFile(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                          disabled={currentAssessment.is_executed}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Question Blocks</h2>
                <button
                  type="button"
                  onClick={addQuestionBlock}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
                  disabled={currentAssessment.is_executed}
                >
                  Add Block
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {questionBlocks.map((block, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Block {index + 1}</h3>
                    {questionBlocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestionBlock(index)}
                        className="text-red-600 hover:text-red-800"
                        disabled={currentAssessment.is_executed}
                      >
                        Remove Block
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                      <select
                        value={block.question_type || "multiple_choice"}
                        onChange={(e) => handleBlockChange(index, "question_type", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      >
                        <option value="multiple_choice">MCQs</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="matching">Match the Columns</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Question Count</label>
                      <input
                        type="number"
                        value={block.question_count || 1}
                        onChange={(e) => handleBlockChange(index, "question_count", Number.parseInt(e.target.value))}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate(`/instructor/assessments/${id}`)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={loading || currentAssessment.is_executed}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  <span className="ml-2">Updating...</span>
                </>
              ) : (
                "Update Assessment"
              )}
            </button>
          </div>
        </form>
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

export default EditAssessment;