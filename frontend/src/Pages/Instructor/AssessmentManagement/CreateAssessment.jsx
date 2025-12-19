import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import useResourceStore from "../../../store/resourceStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import { io } from "socket.io-client";

function CreateAssessment() {
  const navigate = useNavigate();
  const { createAssessment, loading, error } = useAssessmentStore();
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

  // Progress state
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Socket ref
  const socketRef = useRef(null);

  useEffect(() => {
    fetchAllResources();

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

    return () => {
      socket.disconnect();
    };
  }, [fetchAllResources]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBlockChange = (index, field, value) => {
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
      setModal({
        isOpen: true,
        type: "error",
        title: "Validation Error",
        message: validationError,
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressMessage("Starting...");

    const assessmentData = new FormData();
    assessmentData.append("title", formData.title ? formData.title.trim() : null);
    assessmentData.append("prompt", formData.prompt.trim());
    assessmentData.append("externalLinks", JSON.stringify(formData.externalLinks.filter((link) => link.trim())));
    assessmentData.append(
      "question_blocks",
      JSON.stringify(
        questionBlocks.map((block) => ({
          question_type: block.question_type,
          question_count: block.question_count,
          duration_per_question: block.duration_per_question,
          num_options: block.question_type === "multiple_choice" ? block.num_options : null,
          positive_marks: block.positive_marks || 1,
          negative_marks: block.negative_marks || 0,
        }))
      )
    );
    assessmentData.append("selected_resources", JSON.stringify(selectedResources));

    if (socketRef.current?.id) {
      assessmentData.append("socketId", socketRef.current.id);
    }

    newFiles.forEach((file) => assessmentData.append("new_files", file));

    try {
      await createAssessment(assessmentData);

      setModal({
        isOpen: true,
        type: "success",
        title: "Success",
        message: "Assessment created successfully!",
      });

      setTimeout(() => {
        navigate("/instructor/assessments");
      }, 1500);
    } catch (err) {
      setModal({
        isOpen: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to create assessment",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Create New Assessment</h1>
          <p className="text-gray-600">Design a comprehensive assessment with customizable question blocks</p>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <Card className="mb-6 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <p className="text-sm font-medium text-blue-900">{progressMessage}</p>
                </div>
                <p className="text-lg font-bold text-blue-900">{Math.round(progress)}%</p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Assessment Details Card */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 border-0">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
              <h2 className="text-xl font-semibold">📝 Assessment Details</h2>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <div className="space-y-6">
                {/* Title Input */}
                <div>
                  <label htmlFor="title" className="block text-sm font-semibold text-gray-700 mb-2">
                    Assessment Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300"
                    placeholder="e.g., Data Structures Final Exam"
                    required
                  />
                </div>

                {/* Prompt Textarea */}
                <div>
                  <label htmlFor="prompt" className="block text-sm font-semibold text-gray-700 mb-2">
                    Prompt <span className="text-gray-500 font-normal">(Optional if using resources or links)</span>
                  </label>
                  <textarea
                    name="prompt"
                    id="prompt"
                    value={formData.prompt}
                    onChange={handleInputChange}
                    rows={5}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 resize-none"
                    placeholder="Provide a detailed prompt for question generation. Describe the topics, difficulty level, and any specific requirements..."
                  />
                </div>

                {/* Resources Section */}
                <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-4">📚 Resources</label>
                  <div className="space-y-6">
                    {/* Upload Files */}
                    <div>
                      <label htmlFor="new_files" className="block text-sm font-medium text-gray-700 mb-2">
                        Upload New Files
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          id="new_files"
                          multiple
                          accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                          onChange={handleFileChange}
                          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-blue-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          disabled={isProcessing}
                        />
                      </div>
                      {newFiles.length > 0 && (
                        <div className="mt-3 bg-white rounded-lg p-3 border border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 mb-2">Selected Files:</p>
                          <ul className="space-y-1">
                            {newFiles.map((file, index) => (
                              <li key={index} className="text-sm text-gray-700 flex items-center gap-2">
                                <span className="text-blue-600">📄</span>
                                {file.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Existing Resources */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Existing Resources</label>
                      {resourcesLoading ? (
                        <div className="flex justify-center py-8">
                          <LoadingSpinner size="sm" type="dots" color="blue" />
                        </div>
                      ) : resources.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto border-2 border-gray-200 rounded-lg p-4 bg-white">
                          {resources.map((resource) => (
                            <div key={resource.id} className="flex items-center p-2 hover:bg-gray-50 rounded-md transition-colors duration-150">
                              <input
                                type="checkbox"
                                id={`resource-${resource.id}`}
                                checked={selectedResources.includes(resource.id)}
                                onChange={() => handleResourceToggle(resource.id)}
                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                disabled={isProcessing}
                              />
                              <label htmlFor={`resource-${resource.id}`} className="ml-3 text-sm text-gray-700 cursor-pointer flex-1">
                                <span className="font-medium">{resource.name}</span>
                                <span className="text-gray-500 ml-2">({resource.content_type})</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-white border-2 border-dashed border-gray-200 rounded-lg">
                          <p className="text-gray-500">No resources available</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* External Links */}
                <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-100">
                  <label className="block text-sm font-semibold text-gray-700 mb-4">🔗 External Links</label>
                  <div className="space-y-3">
                    {formData.externalLinks.map((link, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="url"
                          value={link}
                          onChange={(e) => handleLinkChange(index, e.target.value)}
                          placeholder="https://example.com/resource"
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300"
                          disabled={isProcessing}
                        />
                        {formData.externalLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExternalLink(index)}
                            className="px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors duration-200 font-medium"
                            disabled={isProcessing}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addExternalLink}
                    className="mt-4 px-5 py-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors duration-200 font-medium"
                    disabled={isProcessing}
                  >
                    + Add Link
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question Blocks Card */}
          <Card className="shadow-md hover:shadow-lg transition-shadow duration-300 border-0">
            <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
              <h2 className="text-xl font-semibold">❓ Question Configuration</h2>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <div className="space-y-6">
                {questionBlocks.map((block, index) => (
                  <div key={index} className="p-6 border-2 border-gray-200 rounded-xl bg-gradient-to-br from-white to-gray-50 hover:border-blue-300 transition-all duration-300">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">Block {index + 1}</span>
                      </h3>
                      {questionBlocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestionBlock(index)}
                          className="text-red-600 hover:text-red-800 font-medium hover:bg-red-50 px-3 py-1 rounded-lg transition-colors duration-200"
                          disabled={isProcessing}
                        >
                          🗑️ Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                        <select
                          value={block.question_type}
                          onChange={(e) => handleBlockChange(index, "question_type", e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300 bg-white"
                          disabled={isProcessing}
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
                          placeholder="e.g. 5"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300"
                          required
                          disabled={isProcessing}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Duration (seconds)</label>
                        <input
                          type="number"
                          value={block.duration_per_question}
                          onChange={(e) => handleBlockChange(index, "duration_per_question", e.target.value)}
                          min="30"
                          placeholder="e.g. 120"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300"
                          required
                          disabled={isProcessing}
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
                            max="6"
                            placeholder="2 to 6"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300"
                            required
                            disabled={isProcessing}
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
                          placeholder="e.g. 1"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300"
                          disabled={isProcessing}
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
                          placeholder="e.g. 0.25"
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 hover:border-gray-300"
                          disabled={isProcessing}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addQuestionBlock}
                  className="w-full py-3 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 rounded-lg hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 font-semibold border-2 border-dashed border-blue-300 hover:border-blue-400"
                  disabled={isProcessing}
                >
                  + Add Question Block
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate("/instructor/assessments")}
              className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium order-2 sm:order-1"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold shadow-md hover:shadow-lg order-1 sm:order-2"
              disabled={loading || isProcessing}
            >
              {isProcessing ? (
                <>
                  <LoadingSpinner size="sm" color="white" type="gradient" />
                  <span className="ml-2">Processing...</span>
                </>
              ) : loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" type="gradient" />
                  <span className="ml-2">Creating...</span>
                </>
              ) : (
                <>
                  <span>✨ Create Assessment</span>
                </>
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

export default CreateAssessment;