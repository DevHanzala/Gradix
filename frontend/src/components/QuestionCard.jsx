function QuestionCard({ question, index }) {
  return (
    <div
      className="bg-white border-2 border-gray-200 rounded-xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-200 animate-slideInUp"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-lg">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base sm:text-lg font-semibold text-gray-900 mb-4 break-words">
            {question.question_text}
          </p>

          {/* Options Display */}
          {question.question_type === "true_false" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                <div className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center font-semibold text-gray-700 flex-shrink-0">
                  T
                </div>
                <span className="text-gray-800 font-medium">True</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                <div className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center font-semibold text-gray-700 flex-shrink-0">
                  F
                </div>
                <span className="text-gray-800 font-medium">False</span>
              </div>
            </div>
          ) : question.options ? (
            <div className="space-y-2">
              {Object.entries(question.options).map(([key, text]) => (
                <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                  <div className="w-8 h-8 border-2 border-gray-400 rounded-full flex items-center justify-center font-semibold text-gray-700 flex-shrink-0">
                    {key}
                  </div>
                  <span className="text-gray-800 break-words">{text}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 text-xs sm:text-sm text-gray-600">
            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
              {question.question_type.replace("_", " ")}
            </span>
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
              +{question.positive_marks} marks
            </span>
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
              -{question.negative_marks} marks
            </span>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
              {question.duration_per_question}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuestionCard;