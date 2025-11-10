import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import useAssessmentStore from "../../../store/assessmentStore.js";
import { Card, CardHeader, CardContent } from "../../../components/ui/Card";
import LoadingSpinner from "../../../components/ui/LoadingSpinner";
import Modal from "../../../components/ui/Modal";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import toast from "react-hot-toast";
import axios from "axios";
import { FaInfoCircle, FaCalendarAlt, FaLink, FaQuestionCircle, FaFileAlt, FaExclamationCircle, FaEdit, FaUsers, FaPrint } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "https://gradeadmin.techmiresolutions.com/api";

function AssessmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentAssessment, getAssessmentById, loading, error } = useAssessmentStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log(`🔍 AssessmentDetail: id from useParams = "${id}"`);
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (!id || isNaN(parseInt(id))) {
          console.warn(`⚠️ Invalid assessment ID: "${id}"`);
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
        await getAssessmentById(parseInt(id));
      } catch (error) {
        console.error("❌ Error fetching assessment:", error);
        const errorMessage = error.response?.data?.message || error.message || "Failed to fetch assessment. Please try again.";
        setModal({ isOpen: true, type: "error", title: "Error", message: errorMessage });
        toast.error(errorMessage);
        if (error.response?.status === 404 || error.message === "Invalid assessment ID") {
          navigate("/instructor/assessments");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, getAssessmentById, navigate]);

  const showModal = (type, title, message) => {
    setModal({ isOpen: true, type, title, message });
    toast[type === "success" ? "success" : "error"](message);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Assessment Details</h1>
          <p className="text-gray-600">View and manage assessment details.</p>
        </div>

        {isLoading || loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading assessment...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <FaExclamationCircle className="text-6xl text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Assessment</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link
              to="/instructor/assessments"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
            >
              Back to Assessments
            </Link>
          </div>
        ) : !currentAssessment ? (
          <div className="text-center py-12">
            <FaFileAlt className="text-6xl text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment Not Found</h3>
            <p className="text-gray-600 mb-4">The requested assessment does not exist.</p>
            <Link
              to="/instructor/assessments"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-200"
            >
              Back to Assessments
            </Link>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">{currentAssessment.title}</h2>
                <div className="flex items-center space-x-4">
                  {!currentAssessment.is_executed && (
                    <Link
                      to={`/instructor/assessments/${id}/edit`}
                      className="flex items-center text-green-600 hover:text-green-900 transition duration-200"
                    >
                      <FaEdit className="mr-1" /> Edit
                    </Link>
                  )}
                  <Link
                    to={`/instructor/assessments/${id}/enroll`}
                    className="flex items-center text-blue-600 hover:text-blue-900 transition duration-200"
                  >
                    <FaUsers className="mr-1" /> Manage Students
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("token");
                        const res = await axios.get(`${API_URL}/taking/assessments/${id}/print`, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!res.data?.success) throw new Error(res.data?.message || "Failed to fetch print data");

                        const questions = res.data.data.questions || [];
                        const container = document.createElement("div");
                        container.style.padding = "24px";
                        container.style.maxWidth = "800px";
                        const title = document.createElement("h2");
                        title.innerText = `${currentAssessment.title} — Answer Key`;
                        title.style.marginBottom = "16px";
                        container.appendChild(title);
                        questions.forEach((q, idx) => {
                          const wrap = document.createElement("div");
                          wrap.style.marginBottom = "12px";
                          const h = document.createElement("h4");
                          h.innerText = `Q${idx + 1}. (${q.question_type})`;
                          const p = document.createElement("p");
                          p.innerText = q.question_text;
                          wrap.appendChild(h);
                          wrap.appendChild(p);
                          if (Array.isArray(q.options) && q.options.length) {
                            const ul = document.createElement("ul");
                            q.options.forEach((opt) => {
                              const li = document.createElement("li");
                              li.innerText = opt;
                              ul.appendChild(li);
                            });
                            wrap.appendChild(ul);
                          }
                          const ans = document.createElement("p");
                          ans.innerText = `Answer: ${q.correct_answer}`;
                          ans.style.fontWeight = "600";
                          wrap.appendChild(ans);
                          container.appendChild(wrap);
                        });

                        const [{ jsPDF }, html2canvas] = await Promise.all([
                          import("jspdf"),
                          import("html2canvas")
                        ]);

                        const canvas = await html2canvas.default(container, { scale: 2 });
                        const imgData = canvas.toDataURL("image/png");
                        const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        const imgWidth = pageWidth - 40;
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;
                        let y = 20;
                        if (imgHeight < pageHeight) {
                          pdf.addImage(imgData, "PNG", 20, y, imgWidth, imgHeight);
                        } else {
                          let sY = 0;
                          const pageCanvas = document.createElement("canvas");
                          const ctx = pageCanvas.getContext("2d");
                          const ratio = imgWidth / canvas.width;
                          pageCanvas.width = imgWidth;
                          pageCanvas.height = pageHeight - 40;
                          while (sY < canvas.height) {
                            ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
                            ctx.drawImage(canvas, 0, sY, canvas.width, (pageHeight - 40) / ratio, 0, 0, imgWidth, pageCanvas.height);
                            const pageImg = pageCanvas.toDataURL("image/png");
                            pdf.addImage(pageImg, "PNG", 20, 20, imgWidth, pageCanvas.height);
                            sY += (pageHeight - 40) / ratio;
                            if (sY < canvas.height) pdf.addPage();
                          }
                        }
                        pdf.save(`assessment_${id}_answer_key.pdf`);
                        toast.success("PDF generated");
                      } catch (e) {
                        console.error(e);
                        toast.error(e.message || "Failed to generate PDF");
                      }
                    }}
                    className="flex items-center text-purple-600 hover:text-purple-900 transition duration-200"
                  >
                    <FaPrint className="mr-1" /> Print (PDF)
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <section>
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                    <FaInfoCircle className="mr-2 text-gray-500" /> Basic Information
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Title</dt>
                      <dd className="mt-1 text-sm text-gray-900">{currentAssessment.title}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Prompt</dt>
                      <dd className="mt-1 text-sm text-gray-900">{currentAssessment.prompt || "N/A"}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Status</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {currentAssessment.is_executed ? "Executed" : "Draft"}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Published</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {currentAssessment.is_published ? "Yes" : "No"}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                    <FaCalendarAlt className="mr-2 text-gray-500" /> Dates
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Created At</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {new Date(currentAssessment.created_at).toLocaleString()}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Updated At</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {currentAssessment.updated_at ? new Date(currentAssessment.updated_at).toLocaleString() : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                    <FaLink className="mr-2 text-gray-500" /> External Links
                  </h3>
                  {currentAssessment.external_links?.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm text-gray-600">
                      {currentAssessment.external_links.map((link, index) => (
                        <li key={index}>
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {link}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-600">No external links provided.</p>
                  )}
                </section>

                <section>
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                    <FaQuestionCircle className="mr-2 text-gray-500" /> Question Blocks
                  </h3>
                  {currentAssessment.question_blocks?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration/Question (s)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Options/First/Second</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Positive Marks</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negative Marks</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentAssessment.question_blocks.map((block, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{block.question_type}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{block.question_count}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{block.duration_per_question}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {block.question_type === "multiple_choice" && block.num_options ? block.num_options :
                                 block.question_type === "matching" && block.num_first_side && block.num_second_side ? `${block.num_first_side}/${block.num_second_side}` : "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{block.positive_marks ?? "N/A"}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{block.negative_marks ?? "N/A"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No question blocks defined.</p>
                  )}
                </section>

                <section>
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                    <FaFileAlt className="mr-2 text-gray-500" /> Resources
                  </h3>
                  {currentAssessment.resources?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {currentAssessment.resources.map((resource, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{resource.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{resource.file_type}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <a
                                  href={resource.file_path}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  View/Download
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No resources attached.</p>
                  )}
                </section>
              </div>
            </CardContent>
          </Card>
        )}
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

export default AssessmentDetail;
