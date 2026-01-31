import { useState, useEffect } from "react";
import useAssessmentStore from "../store/assessmentStore.js";

function useAssessmentPreview(assessmentId) {
  const { getAssessmentById, fetchPreviewQuestions } = useAssessmentStore();

  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [questionError, setQuestionError] = useState(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Load assessment data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getAssessmentById(assessmentId);
        setAssessment(data);
        setError(null);
      } catch (err) {
        setError("Failed to load assessment. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [assessmentId, getAssessmentById]);

  // Load preview questions
  const loadPreviewQuestions = async () => {
    if (!assessment || questions.length > 0 || questionError) return;

    setQuestionsLoading(true);
    try {
      setQuestionError(null);
      const q = await fetchPreviewQuestions(assessmentId);

      if (!Array.isArray(q) || q.length === 0) {
        throw new Error("Empty preview result");
      }

      setQuestions(q);
    } catch (err) {
      setQuestionError("Failed to generate sample questions. Please retry.");
    } finally {
      setQuestionsLoading(false);
    }
  };

  return {
    assessment,
    questions,
    loading,
    error,
    questionError,
    questionsLoading,
    loadPreviewQuestions
  };
}

export default useAssessmentPreview;