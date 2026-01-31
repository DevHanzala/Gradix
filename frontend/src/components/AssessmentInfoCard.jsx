import { FaFileAlt } from "react-icons/fa";

function AssessmentInfoCard({ assessment }) {
  const totalQuestions = assessment.question_blocks?.reduce((sum, b) => sum + (b.question_count || 0), 0) || 0;
  const resourceCount = assessment.resources?.length || 0;

  return (
    <div className="mb-6 bg-white rounded-xl shadow-lg border-2 border-gray-200 p-4 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <FaFileAlt className="text-indigo-600 text-xl" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 break-words">
            {assessment.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
              {totalQuestions} Questions
            </span>
            {resourceCount > 0 && (
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
                {resourceCount} Resources
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssessmentInfoCard;