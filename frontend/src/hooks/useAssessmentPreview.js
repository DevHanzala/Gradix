import { useState, useEffect, useCallback } from "react";
import { reportError } from "../utils/reportError.js";
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
        setError(reportError(err, "Failed to load assessment. Please try again.", { silent: true }));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [assessmentId, getAssessmentById]);

  // Load preview questions
  const loadPreviewQuestions = useCallback(async () => {
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
      setQuestionError(reportError(err, "Failed to generate sample questions. Please retry.", { silent: true }));
    } finally {
      setQuestionsLoading(false);
    }
  }, [assessment, questions.length, questionError, assessmentId, fetchPreviewQuestions]);

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