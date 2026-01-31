import LoadingSpinner from "../ui/LoadingSpinner";
import QuestionCard from "./QuestionCard";

function SampleQuestionsTab({ questions, questionError, loading }) {
  return (
    <div className="animate-fadeIn">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">
        Sample Questions (What Students Will See)
      </h2>
      {questionError ? (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-semibold mb-2">
            Failed to generate preview questions
          </p>
          <p className="text-sm text-gray-600">{questionError}</p>
        </div>
      ) : loading ? (
        <div className="text-center py-16 sm:py-20">
          <LoadingSpinner size="lg" color="blue" type="dots" />
          <p className="mt-4 text-gray-600 font-medium">Generating real sample questions from AI...</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {questions.map((question, index) => (
            <QuestionCard key={index} question={question} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

export default SampleQuestionsTab;