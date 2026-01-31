import { FaFileAlt, FaCopy, FaCheckCircle } from "react-icons/fa";
import { generateAIPrompt } from "../../utils/promptGenerator";

function PromptTab({ assessment, copied, onCopy }) {
  const promptText = generateAIPrompt(assessment);

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Exact Prompt Sent to AI Model</h2>
          <p className="text-gray-600 text-sm">
            This is the <strong className="text-blue-600">100% identical prompt</strong> used by Gradewise-AI.<br className="hidden sm:block" />
            Copy and paste it into ChatGPT, Gemini, Grok, or Claude — <strong className="text-green-600">same result guaranteed</strong>.
          </p>
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 font-bold shadow-lg transform transition-all hover:-translate-y-0.5 w-full sm:w-auto flex-shrink-0"
        >
          {copied ? (
            <>
              <FaCheckCircle />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <FaCopy />
              <span>Copy Full Prompt</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-gray-700 rounded-xl p-4 sm:p-6 lg:p-7 overflow-hidden shadow-2xl">
        <pre className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-green-400 font-mono overflow-x-auto">
          {promptText}
        </pre>
      </div>
    </div>
  );
}

export default PromptTab;