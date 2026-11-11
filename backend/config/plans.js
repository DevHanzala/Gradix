/**
 * Plans and their limits, in one place. Prices are in Pakistani rupees per month.
 * null = no limit. There is no payment gateway: the Super Admin assigns plans by hand.
 *
 *  assessmentsPerMonth  new assessments an instructor creates per calendar month
 *  students             distinct students enrolled across the account's assessments
 *  aiQuestionsPerMonth  AI-written questions per calendar month (from the LLM usage log)
 *  liveSessionSize      participants in one live session
 *  storageMb            files kept in storage (uploads, images, reports)
 */
export const PLANS = {
  free: {
    id: "free",
    pricePkr: 0,
    limits: { assessmentsPerMonth: 5, students: 40, aiQuestionsPerMonth: 300, liveSessionSize: 40, storageMb: 200 },
  },
  pro: {
    id: "pro",
    pricePkr: 2500,
    limits: { assessmentsPerMonth: 50, students: 300, aiQuestionsPerMonth: 5000, liveSessionSize: 150, storageMb: 2048 },
  },
  institution: {
    id: "institution",
    pricePkr: 25000,
    limits: { assessmentsPerMonth: null, students: 3000, aiQuestionsPerMonth: 50000, liveSessionSize: 300, storageMb: 20480 },
  },
};
export const DEFAULT_PLAN = "free";
export const PLAN_IDS = Object.keys(PLANS);
