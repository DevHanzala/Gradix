import { create } from "zustand";
import {
  getAttemptStateApi,
  startAssessmentApi,
  saveAnswerApi,
  advanceQuestionApi,
  submitAssessmentApi,
} from "../api/studentAssessment.api";

/**
 * Exam session state. The server is the source of truth for the attempt,
 * the current question and the remaining time; this store mirrors it,
 * autosaves answers and retries saves that failed while offline.
 *
 * phase: idle | loading | not_started | starting | in_progress | submitting | completed | error
 * saveStatus: idle | saving | saved | offline | error
 */

const SAVE_DEBOUNCE_MS = { short_answer: 800, default: 250 };
const RETRY_DELAY_MS = 3000;

const saveTimers = new Map(); // questionId -> timeout id
let retryTimer = null;

const errorCode = (error) => error?.response?.data?.code;
const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
const isNetworkError = (error) => !error?.response;

const toDeadline = (seconds) => Date.now() + Math.max(0, Number(seconds) || 0) * 1000;

const initialState = {
  phase: "idle",
  assessmentId: null,
  attemptId: null,
  language: "en",
  questions: [],
  answers: {},
  currentIndex: 0,
  questionDeadline: 0,
  overallDeadline: 0,
  pending: {}, // questionId -> answer awaiting a successful save
  saveStatus: "idle",
  result: null,
  error: null,
  errorCode: null,
};

const useStudentAssessmentStore = create((set, get) => {
  /** Apply an in-progress attempt state returned by the server. */
  const applyInProgress = (data) => {
    set({
      phase: "in_progress",
      attemptId: data.attemptId,
      assessmentId: data.assessmentId,
      language: data.language,
      questions: data.questions || [],
      answers: { ...(data.savedAnswers || {}), ...get().pending },
      currentIndex: data.currentQuestionIndex || 0,
      questionDeadline: toDeadline(data.questionRemainingSeconds),
      overallDeadline: toDeadline(data.remainingSeconds),
      error: null,
      errorCode: null,
    });
  };

  const applyServerState = (data) => {
    if (data.status === "completed") {
      set({ phase: "completed", result: data, attemptId: data.attemptId, pending: {}, error: null });
    } else if (data.status === "in_progress") {
      applyInProgress(data);
    } else {
      set({ phase: "not_started", error: null });
    }
  };

  const scheduleRetry = () => {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      get().flushPending();
    }, RETRY_DELAY_MS);
  };

  /** Save one answer now. Returns true on success. */
  const persistAnswer = async (questionId) => {
    const { attemptId, pending, phase } = get();
    if (!attemptId || phase !== "in_progress" || !(questionId in pending)) return true;
    const answer = pending[questionId];

    set({ saveStatus: "saving" });
    try {
      await saveAnswerApi(attemptId, questionId, answer);
      const stillPending = { ...get().pending };
      // Only clear if the user didn't change the answer meanwhile.
      if (stillPending[questionId] === answer) delete stillPending[questionId];
      set({
        pending: stillPending,
        saveStatus: Object.keys(stillPending).length ? "saving" : "saved",
      });
      return true;
    } catch (error) {
      if (isNetworkError(error)) {
        set({ saveStatus: "offline" });
        scheduleRetry();
        return false;
      }
      const code = errorCode(error);
      const stillPending = { ...get().pending };
      delete stillPending[questionId];
      set({ pending: stillPending, saveStatus: "error" });
      if (code === "ATTEMPT_CLOSED") {
        await get().loadAttempt(get().assessmentId);
      }
      return false;
    }
  };

  return {
    ...initialState,

    reset: () => {
      saveTimers.forEach((t) => clearTimeout(t));
      saveTimers.clear();
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      set({ ...initialState });
    },

    /** Load the current attempt state (resume after refresh). */
    loadAttempt: async (assessmentId) => {
      set({ phase: "loading", assessmentId, error: null, errorCode: null });
      try {
        const response = await getAttemptStateApi(assessmentId);
        applyServerState(response.data.data);
      } catch (error) {
        set({
          phase: "error",
          error: errorMessage(error, "Could not load this assessment."),
          errorCode: errorCode(error) || null,
        });
      }
    },

    /** Start (or resume) the attempt in the chosen language. */
    startAssessment: async (assessmentId, language = "en") => {
      set({ phase: "starting", error: null, errorCode: null });
      try {
        const response = await startAssessmentApi(assessmentId, { language });
        applyServerState(response.data.data);
      } catch (error) {
        const code = errorCode(error);
        if (code === "ALREADY_ATTEMPTED") {
          await get().loadAttempt(assessmentId);
          return;
        }
        set({
          phase: "not_started",
          error: errorMessage(error, "Could not start the assessment. Please try again."),
          errorCode: code || null,
        });
      }
    },

    /** Record an answer locally and autosave it (debounced). */
    setAnswer: (questionId, answer, questionType) => {
      set((state) => ({
        answers: { ...state.answers, [questionId]: answer },
        pending: { ...state.pending, [questionId]: answer },
        saveStatus: "saving",
      }));
      clearTimeout(saveTimers.get(questionId));
      const delay = SAVE_DEBOUNCE_MS[questionType] ?? SAVE_DEBOUNCE_MS.default;
      saveTimers.set(
        questionId,
        setTimeout(() => {
          saveTimers.delete(questionId);
          persistAnswer(questionId);
        }, delay)
      );
    },

    /** Save everything still pending (used before advancing/submitting and when back online). */
    flushPending: async () => {
      saveTimers.forEach((t) => clearTimeout(t));
      saveTimers.clear();
      const ids = Object.keys(get().pending);
      let ok = true;
      for (const id of ids) {
        ok = (await persistAnswer(Number(id))) && ok;
      }
      return ok;
    },

    /** Leave the current question (manually or when its timer ends). */
    advance: async () => {
      const { attemptId, currentIndex, questions, phase } = get();
      if (phase !== "in_progress") return;
      if (currentIndex >= questions.length - 1) {
        await get().submit();
        return;
      }

      await get().flushPending();
      // Move on immediately in the UI; the server confirms the window.
      set({
        currentIndex: currentIndex + 1,
        questionDeadline: toDeadline(questions[currentIndex + 1]?.duration_per_question),
      });

      try {
        const response = await advanceQuestionApi(attemptId, currentIndex);
        const data = response.data.data;
        if (data.finished) {
          set({ phase: "completed", result: data.result, pending: {} });
          return;
        }
        set({
          currentIndex: data.currentQuestionIndex,
          questionDeadline: toDeadline(data.questionRemainingSeconds),
          overallDeadline: toDeadline(data.remainingSeconds),
        });
      } catch (error) {
        if (isNetworkError(error)) {
          set({ saveStatus: "offline" });
          return; // The server auto-advances by time; we resync on the next call.
        }
        await get().loadAttempt(get().assessmentId);
      }
    },

    /** Submit the attempt (manual, last-question timeout, or overall timeout). */
    submit: async () => {
      const { attemptId, assessmentId, phase, answers } = get();
      if (phase !== "in_progress") return;
      set({ phase: "submitting" });

      await get().flushPending();
      const payload = Object.entries(answers).map(([questionId, answer]) => ({
        questionId: Number(questionId),
        answer,
      }));

      try {
        const response = await submitAssessmentApi(assessmentId, { attemptId, answers: payload });
        set({ phase: "completed", result: response.data.data, pending: {} });
      } catch (error) {
        if (isNetworkError(error)) {
          set({
            phase: "in_progress",
            saveStatus: "offline",
            error: "You appear to be offline. Your answers are kept; submitting again when you are back online.",
          });
          setTimeout(() => get().submit(), RETRY_DELAY_MS);
          return;
        }
        await get().loadAttempt(assessmentId);
      }
    },

    clearError: () => set({ error: null, errorCode: null }),
  };
});

export default useStudentAssessmentStore;
