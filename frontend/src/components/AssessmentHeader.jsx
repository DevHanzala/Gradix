import { Link } from "react-router-dom";
import { FaEye, FaEdit } from "react-icons/fa";

function AssessmentHeader({ assessmentId }) {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <FaEye className="text-2xl" />
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Assessment Preview</h1>
            </div>
            <p className="text-blue-100 text-sm sm:text-base">
              See exactly how the AI will interpret your setup and what students will experience
            </p>
          </div>
          <Link
            to={`/instructor/assessments/${assessmentId}/edit`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl hover:bg-blue-50 font-semibold shadow-lg transform transition-all hover:-translate-y-0.5 hover:shadow-xl w-full sm:w-auto"
          >
            <FaEdit className="text-lg" />
            <span>Edit Assessment</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AssessmentHeader;