import { create } from "zustand";
import i18n from "../i18n/index.js";
import { errorMessage } from "../utils/forms.js";
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
 * The server sends ONE question at a time: the next one is only known after
 * the student moves on (it may depend on their answers when adaptive).
 *
 * phase: idle | loading | not_started | starting | in_progress | submitting | completed | error
 * saveStatus: idle | saving | saved | offline | error
 */

const SAVE_DEBOUNCE_MS = { short_answer: 800, default: 250 };
const RETRY_DELAY_MS = 3000;
const PREPARING_RETRY_MS = 3000;

const saveTimers = new Map(); // questionId -> timeout id
let retryTimer = null;

const errorCode = (error) => error?.response?.data?.code;
const isNetworkError = (error) => !error?.response;

const toDeadline = (seconds) => Date.now() + Math.max(0, Number(seconds) || 0) * 1000;

const initialState = {
  phase: "idle",
  assessmentId: null,
  attemptId: null,
  language: "en",
  question: null,
  totalQuestions: 0,
  answers: {},
  currentIndex: 0,
  /** True while the next question is being prepared by the server. */
  preparing: false,
  adaptive: false,
  /** Only present when the instructor enabled "show live score". */
  liveScore: null,
  lastAnswer: null,
  questionDeadline: 0,
  overallDeadline: 0,
  pending: {}, // questionId -> answer awaiting a successful save
  saveStatus: "idle",
  result: null,
  error: null,
  errorCode: null,
  /** Languages the student can start in now (empty until the assessment is published). */
  availableLanguages: [],
};

const useStudentAssessmentStore = create((set, get) => {
  /** Apply an in-progress attempt state returned by the server. */
  const applyInProgress = (data) => {
    set({
      phase: "in_progress",
      attemptId: data.attemptId,
      assessmentId: data.assessmentId,
      language: data.language,
      question: data.question || null,
      totalQuestions: data.totalQuestions || 0,
      answers: {
        ...(data.question && data.savedAnswer !== null && data.savedAnswer !== undefined ? { [data.question.id]: data.savedAnswer } : {}),
        ...get().pending,
      },
      currentIndex: data.currentQuestionIndex || 0,
      preparing: false,
      adaptive: Boolean(data.adaptive),
      liveScore: data.liveScore || null,
      lastAnswer: data.lastAnswer || null,
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
      set({ phase: "not_started", error: null, availableLanguages: data.availableLanguages || [] });
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
          error: errorMessage(error, i18n.t("assessments.loadOneFailed")),
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
          error: errorMessage(error, i18n.t("exam.startFailed")),
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

    /** Leave the current question (manually or when its timer ends); the server sends the next one. */
    advance: async () => {
      const { attemptId, currentIndex, totalQuestions, phase, preparing } = get();
      if (phase !== "in_progress" || preparing) return;
      if (currentIndex >= totalQuestions - 1) {
        await get().submit();
        return;
      }

      await get().flushPending();
      set({ preparing: true });
      try {
        const response = await advanceQuestionApi(attemptId, currentIndex);
        const data = response.data.data;
        if (data.finished) {
          set({ phase: "completed", result: data.result, pending: {}, preparing: false });
          return;
        }
        applyInProgress(data);
      } catch (error) {
        if (isNetworkError(error)) {
          set({ saveStatus: "offline", preparing: false });
          return; // The server closes windows by time; we resync on the next call.
        }
        if (errorCode(error) === "POOL_EXHAUSTED") {
          // The next question is still being prepared: keep waiting and ask again.
          setTimeout(() => get().resync(), PREPARING_RETRY_MS);
          return;
        }
        await get().loadAttempt(get().assessmentId);
      }
    },

    /** Re-read the attempt without leaving the exam screen (e.g. while the next question is prepared). */
    resync: async () => {
      const { assessmentId, phase } = get();
      if (phase !== "in_progress") return;
      try {
        const response = await getAttemptStateApi(assessmentId);
        applyServerState(response.data.data);
      } catch (error) {
        if (errorCode(error) === "POOL_EXHAUSTED" || isNetworkError(error)) {
          setTimeout(() => get().resync(), PREPARING_RETRY_MS);
          return;
        }
        set({ phase: "error", error: errorMessage(error, i18n.t("assessments.loadOneFailed")), preparing: false });
      }
    },

    /** Submit the attempt (manual, last-question timeout, or overall timeout). */
    submit: async () => {
      const { attemptId, assessmentId, phase, answers, question } = get();
      if (phase !== "in_progress") return;
      set({ phase: "submitting" });

      await get().flushPending();
      // Only the current question can still change; earlier ones are closed on the server.
      const payload =
        question && answers[question.id] !== undefined ? [{ questionId: question.id, answer: answers[question.id] }] : [];

      try {
        const response = await submitAssessmentApi(assessmentId, { attemptId, answers: payload });
        set({ phase: "completed", result: response.data.data, pending: {} });
      } catch (error) {
        if (isNetworkError(error)) {
          set({
            phase: "in_progress",
            saveStatus: "offline",
            error: i18n.t("exam.offlineSubmit"),
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
