import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import useResourceStore from "../../../store/resourceStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

function EditAssessment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentAssessment, loading, error, getAssessmentById, updateAssessment } = useAssessmentStore();
  const { resources, fetchAllResources, loading: resourcesLoading } = useResourceStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });

  const [formData, setFormData] = useState({
    title: "",
    prompt: "",
    externalLinks: [""],
  });

  const [questionBlocks, setQuestionBlocks] = useState([
    {
      question_type: "multiple_choice",
      question_count: 1,
      duration_per_question: 120,
      num_options: 4,
      positive_marks: 1,
      negative_marks: 0,
    },
  ]);

  const [selectedResources, setSelectedResources] = useState([]);
  const [newFiles, setNewFiles] = useState([]);

  // NEW: Progress state
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
const [questionBlocksTouched, setQuestionBlocksTouched] = useState(false);

  // NEW: Socket ref
  const socketRef = useRef(null);

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
        await fetchAllResources();
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
  }, [id, getAssessmentById, fetchAllResources, navigate, location.pathname]);

  useEffect(() => {
    if (currentAssessment) {
      setFormData({
        title: currentAssessment.title || "",
        prompt: currentAssessment.prompt || "",
        externalLinks: Array.isArray(currentAssessment.external_links) ? currentAssessment.external_links : [""],
      });
      setQuestionBlocks(
        Array.isArray(currentAssessment.question_blocks) && currentAssessment.question_blocks.length > 0
          ? currentAssessment.question_blocks.map(block => ({
            question_type: block.question_type || "multiple_choice",
            question_count: Number(block.question_count) || 1,
            duration_per_question: Number(block.duration_per_question) || 120,
            num_options: Number(block.num_options) || 4,
            positive_marks: Number(block.positive_marks) || 1,
            negative_marks: Number(block.negative_marks) || 0,
          }))
          : [{ question_type: "multiple_choice", question_count: 1, duration_per_question: 120, num_options: 4, positive_marks: 1, negative_marks: 0 }]
      );
      setSelectedResources(
        Array.isArray(currentAssessment.resources)
          ? currentAssessment.resources.map(r => r.id).filter(id => id && !isNaN(id))
          : []
      );
      console.log(`🔍 Loaded selectedResources:`, currentAssessment.resources?.map(r => r.id));
    }
  }, [currentAssessment]);

  // NEW: Socket connection for progress
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const socket = io(API_URL, {
      transports: ["websocket"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("assessment-progress", (data) => {
      setProgress(data.percent);
      setProgressMessage(data.message);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    return () => socket.disconnect();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBlockChange = (index, field, value) => {
  setQuestionBlocksTouched(true);  // ADD THIS LINE
  setQuestionBlocks((prev) =>
    prev.map((block, i) =>
      i === index
        ? {
            ...block,
            [field]:
              field === "question_count" || field === "duration_per_question" || field === "num_options"
                ? Math.max(Number.parseInt(value) || 1, 1)
                : field === "positive_marks" || field === "negative_marks"
                  ? value === "" || value === null
                    ? null
                    : Math.max(Number.parseFloat(value) || 0, 0)
                  : value,
          }
        : block
    )
  );
};

const addQuestionBlock = () => {
  setQuestionBlocksTouched(true);  // ADD THIS LINE
  setQuestionBlocks((prev) => [
    ...prev,
    {
      question_type: "multiple_choice",
      question_count: 1,
      duration_per_question: 120,
      num_options: 4,
      positive_marks: 1,
      negative_marks: 0,
    },
  ]);
};

 const removeQuestionBlock = (index) => {
  setQuestionBlocksTouched(true);  // ADD THIS LINE
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

  const handleLinkChange = (index, value) => {
    setFormData((prev) => ({
      ...prev,
      externalLinks: prev.externalLinks.map((link, i) => (i === index ? value : link)),
    }));
  };

  const handleFileChange = (e) => {
    setNewFiles([...e.target.files]);
  };

  const handleResourceToggle = (resourceId) => {
    setSelectedResources((prev) =>
      prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]
    );
  };

  const validateForm = () => {
    if (!formData.title || !formData.title.trim()) {
      return "Assessment Title is required";
    }

    const hasResources = selectedResources.length > 0 || newFiles.length > 0;
    const hasLinks = formData.externalLinks.some(link => link && link.trim());

    if (!formData.prompt?.trim() && !hasResources && !hasLinks) {
      return "You must provide either a Prompt, Resources, or External Links";
    }

    for (const block of questionBlocks) {
      if (!block.question_count || block.question_count < 1) {
        return "Question count must be at least 1";
      }
      if (!block.duration_per_question || block.duration_per_question < 30) {
        return "Duration per question must be at least 30 seconds";
      }
      if (block.question_type === "multiple_choice" && (!block.num_options || block.num_options < 2)) {
        return "Multiple choice needs at least 2 options";
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setModal({ isOpen: true, type: "error", title: "Validation Error", message: validationError });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressMessage("Updating...");

    const assessmentData = new FormData();

    // CONSOLE: Log title before appending
    console.log("DEBUG: Frontend EditAssessment - Title before append:", formData.title, "Trimmed:", formData.title.trim());

    // Always send title
    assessmentData.append("title", formData.title.trim());

    // Prompt optional
    if (formData.prompt?.trim()) {
      assessmentData.append("prompt", formData.prompt.trim());
    }

    assessmentData.append("externalLinks", JSON.stringify(formData.externalLinks.filter(l => l.trim())));
   // Only send question_blocks if user actually changed them
if (questionBlocksTouched) {
  assessmentData.append("question_blocks", JSON.stringify(questionBlocks.map(b => ({
    question_type: b.question_type,
    question_count: b.question_count,
    duration_per_question: b.duration_per_question,
    num_options: b.question_type === "multiple_choice" ? b.num_options : null,
    positive_marks: b.positive_marks || 1,
    negative_marks: b.negative_marks || 0,
  }))));
}
    assessmentData.append("selected_resources", JSON.stringify(selectedResources));
    newFiles.forEach(f => assessmentData.append("new_files", f));
    if (socketRef.current?.id) assessmentData.append("socketId", socketRef.current.id);

    // CONSOLE: Log all FormData entries
    console.log("DEBUG: Frontend EditAssessment - FormData contents:");
    for (let [key, value] of assessmentData.entries()) {
      console.log(`  ${key}: ${value}`);
    }

    try {
      await updateAssessment(parseInt(id), assessmentData);
      setModal({ isOpen: true, type: "success", title: "Success!", message: "Assessment updated!" });
      setTimeout(() => navigate("/instructor/assessments"), 1500);
    } catch (err) {
      console.error("DEBUG: Frontend EditAssessment - Update error:", err);
      setModal({ isOpen: true, type: "error", title: "Error", message: err.message || "Update failed" });
    } finally {
      setIsProcessing(false);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit Assessment</h1>

        {/* NEW: Progress Bar */}
        {isProcessing && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-900">{progressMessage}</p>
                <p className="text-sm font-semibold text-blue-900">{Math.round(progress)}%</p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">Assessment Details</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Assessment Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter assessment title"
                    disabled={currentAssessment.is_executed}
                  />
                </div>

                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
                    AI Prompt <span className="text-gray-500">(Optional if using resources or links)</span>
                  </label>
                  <textarea
                    name="prompt"
                    id="prompt"
                    value={formData.prompt}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Provide a detailed prompt for question generation"
                    disabled={currentAssessment.is_executed}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">External Links (Optional)</label>
                  {formData.externalLinks.map((link, index) => (
                    <div key={index} className="flex items-center space-x-2 mb-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => handleLinkChange(index, e.target.value)}
                        placeholder="https://example.com"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      />
                      {formData.externalLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExternalLink(index)}
                          className="px-3 py-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                          disabled={currentAssessment.is_executed}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addExternalLink}
                    className="mt-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200"
                    disabled={currentAssessment.is_executed}
                  >
                    Add Link
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resources</label>
                  <div className="flex flex-col space-y-4">
                    <div>
                      <label htmlFor="new_files" className="block text-sm font-medium text-gray-700 mb-2">
                        Upload New Files (Optional)
                      </label>
                      <input
                        type="file"
                        id="new_files"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      />
                      {newFiles.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {newFiles.map((file, index) => (
                            <li key={index} className="text-sm text-gray-600">
                              {file.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Existing Resources (Optional)</label>
                      {resourcesLoading ? (
                        <LoadingSpinner size="sm" />
                      ) : resources.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-300 rounded-md p-2">
                          {resources.map((resource) => (
                            <div key={resource.id} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`resource-${resource.id}`}
                                checked={selectedResources.includes(resource.id)}
                                onChange={() => handleResourceToggle(resource.id)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                disabled={currentAssessment.is_executed}
                              />
                              <label htmlFor={`resource-${resource.id}`} className="ml-2 text-sm text-gray-600">
                                {resource.name} ({resource.content_type})
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No resources available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-900">Question Blocks (Optional)</h2>
            </CardHeader>
            <CardContent>
              {questionBlocks.map((block, index) => (
                <div key={index} className="p-4 border border-gray-300 rounded-md mb-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Question Block {index + 1}</h3>
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
                        value={block.question_type}
                        onChange={(e) => handleBlockChange(index, "question_type", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="true_false">True/False</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Question Count</label>
                      <input
                        type="number"
                        value={block.question_count}
                        onChange={(e) => handleBlockChange(index, "question_count", e.target.value)}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Duration per Question (seconds)</label>
                      <input
                        type="number"
                        value={block.duration_per_question}
                        onChange={(e) => handleBlockChange(index, "duration_per_question", e.target.value)}
                        min="30"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      />
                    </div>

                    {block.question_type === "multiple_choice" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Number of Options</label>
                        <input
                          type="number"
                          value={block.num_options}
                          onChange={(e) => handleBlockChange(index, "num_options", e.target.value)}
                          min="2"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={currentAssessment.is_executed}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Positive Marks</label>
                      <input
                        type="number"
                        value={block.positive_marks || ""}
                        onChange={(e) => handleBlockChange(index, "positive_marks", e.target.value)}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Negative Marks</label>
                      <input
                        type="number"
                        value={block.negative_marks || ""}
                        onChange={(e) => handleBlockChange(index, "negative_marks", e.target.value)}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={currentAssessment.is_executed}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addQuestionBlock}
                className="mt-4 px-4 py-2 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200"
                disabled={currentAssessment.is_executed}
              >
                Add Question Block
              </button>
            </CardContent>
          </Card>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate("/instructor/assessments")}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition duration-200"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={loading || isProcessing || currentAssessment.is_executed}
            >
              {isProcessing ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  <span className="ml-2">Processing...</span>
                </>
              ) : loading ? (
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
