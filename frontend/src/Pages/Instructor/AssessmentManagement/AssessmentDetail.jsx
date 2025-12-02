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

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function AssessmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentAssessment, getAssessmentById, loading, error } = useAssessmentStore();
  const [modal, setModal] = useState({ isOpen: false, type: "info", title: "", message: "" });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (!id || isNaN(parseInt(id))) {
          toast.error("Invalid assessment ID");
          navigate("/instructor/assessments");
          return;
        }
        await getAssessmentById(parseInt(id));
      } catch (error) {
        const msg = error.response?.data?.message || error.message || "Failed to load assessment";
        toast.error(msg);
        if (error.response?.status === 404) navigate("/instructor/assessments");
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

  // PDF Generation (unchanged)
  const generatePDF = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/taking/assessments/${id}/print`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.data?.success) throw new Error(res.data?.message || "Failed");

      const questions = res.data.data.questions || [];
      const container = document.createElement("div");
      container.style.padding = "40px";
      container.style.fontFamily = "Arial, sans-serif";
      container.style.background = "white";

      const title = document.createElement("h2");
      title.innerText = `${currentAssessment.title} — Answer Key`;
      title.style.fontSize = "24px";
      title.style.marginBottom = "30px";
      title.style.textAlign = "center";
      container.appendChild(title);

      questions.forEach((q, idx) => {
        const div = document.createElement("div");
        div.style.marginBottom = "20px";
        div.style.pageBreakInside = "avoid";

        const qNum = document.createElement("strong");
        qNum.innerText = `Q${idx + 1}. `;
        div.appendChild(qNum);

        const type = document.createElement("em");
        type.innerText = `(${q.question_type}) `;
        div.appendChild(type);

        const text = document.createElement("span");
        text.innerText = q.question_text;
        div.appendChild(text);
        div.appendChild(document.createElement("br"));

        if (q.options?.length) {
          const ul = document.createElement("ul");
          ul.style.margin = "8px 0";
          ul.style.paddingLeft = "20px";
          q.options.forEach(opt => {
            const li = document.createElement("li");
            li.innerText = opt;
            ul.appendChild(li);
          });
          div.appendChild(ul);
        }

        const ans = document.createElement("strong");
        ans.innerText = `Answer: ${q.correct_answer}`;
        ans.style.color = "#1f2937";
        div.appendChild(ans);
        container.appendChild(div);
      });

      const [{ jsPDF }, html2canvas] = await Promise.all([import("jspdf"), import("html2canvas")]);
      const canvas = await html2canvas.default(container, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "PNG", 20, 20, width - 40, 0);
      pdf.save(`assessment_${id}_answer_key.pdf`);
      toast.success("PDF generated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center items-center py-32">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Loading assessment...</span>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !currentAssessment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-16">
          <FaExclamationCircle className="mx-auto text-6xl text-red-500 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Assessment Not Found</h3>
          <p className="text-gray-600 mb-6">The requested assessment could not be loaded.</p>
          <Link to="/instructor/assessments" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Assessments
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="w-full mx-auto px-4 sm:px-4 lg:px-8 xl:px-10 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Assessment Details</h1>
          <p className="text-gray-600 mt-1">View and manage this assessment</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <h2 className="text-2xl font-bold">{currentAssessment.title}</h2>
              <div className="flex flex-wrap gap-3 text-sm">
                {!currentAssessment.is_executed && (
                  <Link to={`/instructor/assessments/${id}/edit`} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition">
                    <FaEdit /> Edit
                  </Link>
                )}
                <Link to={`/instructor/assessments/${id}/enroll`} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition">
                  <FaUsers /> Students
                </Link>
                <button onClick={generatePDF} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition">
                  <FaPrint /> Print PDF
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            {/* Basic Info */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FaInfoCircle className="text-blue-600" /> Basic Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="font-medium text-gray-600">Title:</span>
                  <p className="mt-1 font-semibold">{currentAssessment.title}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="font-medium text-gray-600">Prompt:</span>
                  <p className="mt-1">{currentAssessment.prompt || "—"}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="font-medium text-gray-600">Status:</span>
                  <p className="mt-1 font-semibold">{currentAssessment.is_executed ? "Executed" : "Draft"}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="font-medium text-gray-600">Published:</span>
                  <p className="mt-1 font-semibold">{currentAssessment.is_published ? "Yes" : "No"}</p>
                </div>
              </div>
            </section>

            {/* Dates */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FaCalendarAlt className="text-green-600" /> Dates
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="font-medium text-gray-600">Created:</span>
                  <p className="mt-1">{new Date(currentAssessment.created_at).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <span className="font-medium text-gray-600">Updated:</span>
                  <p className="mt-1">{currentAssessment.updated_at ? new Date(currentAssessment.updated_at).toLocaleString() : "—"}</p>
                </div>
              </div>
            </section>

            {/* External Links */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FaLink className="text-purple-600" /> External Links
              </h3>
              {currentAssessment.external_links?.length > 0 ? (
                <div className="space-y-2">
                  {currentAssessment.external_links.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                       className="block text-blue-600 hover:underline text-sm break-all">
                      {link}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No external links</p>
              )}
            </section>

            {/* Question Blocks - Desktop Table */}
            <section className="hidden lg:block">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FaQuestionCircle className="text-indigo-600" /> Question Blocks
              </h3>
              {currentAssessment.question_blocks?.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time/Q</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Options</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">+Marks</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">-Marks</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentAssessment.question_blocks.map((b, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{b.question_type}</td>
                          <td className="px-4 py-3 text-sm">{b.question_count}</td>
                          <td className="px-4 py-3 text-sm">{b.duration_per_question}s</td>
                          <td className="px-4 py-3 text-sm">
                            {b.question_type === "multiple_choice" ? b.num_options :
                             b.question_type === "matching" ? `${b.num_first_side}/${b.num_second_side}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">{b.positive_marks ?? "—"}</td>
                          <td className="px-4 py-3 text-sm">{b.negative_marks ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 italic">No question blocks</p>
              )}
            </section>

            {/* Question Blocks - Mobile Cards */}
            <section className="lg:hidden space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FaQuestionCircle className="text-indigo-600" /> Question Blocks
              </h3>
              {currentAssessment.question_blocks?.length > 0 ? (
                currentAssessment.question_blocks.map((b, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><strong>Type:</strong> {b.question_type}</div>
                      <div><strong>Count:</strong> {b.question_count}</div>
                      <div><strong>Time/Q:</strong> {b.duration_per_question}s</div>
                      <div><strong>Options:</strong> {b.question_type === "multiple_choice" ? b.num_options : b.question_type === "matching" ? `${b.num_first_side}/${b.num_second_side}` : "—"}</div>
                      <div><strong>+Marks:</strong> {b.positive_marks ?? "—"}</div>
                      <div><strong>-Marks:</strong> {b.negative_marks ?? "—"}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No question blocks</p>
              )}
            </section>

            {/* Resources */}
            <section>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <FaFileAlt className="text-orange-600" /> Resources
              </h3>
              {currentAssessment.resources?.length > 0 ? (
                <div className="space-y-3">
                  {currentAssessment.resources.map((r, i) => (
                    <div key={i} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.file_type}</p>
                      </div>
                      <a href={r.file_path} target="_blank" rel="noopener noreferrer"
                         className="text-blue-600 hover:underline font-medium text-sm">
                        View/Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No resources attached</p>
              )}
            </section>
          </CardContent>
        </Card>
      </div>

      <Footer />

      <Modal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title}>
        {modal.message}
      </Modal>
    </div>
  );
}

export default AssessmentDetail;