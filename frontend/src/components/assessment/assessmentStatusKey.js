/** Assessment lifecycle order. While objectives are extracted, "draft" shows as extracting. */
export const STATUS_STEPS = ["draft", "objectives_ready", "publishing", "published"];

export const statusKey = (assessment) => {
  if (assessment?.is_executed || assessment?.isExecuted) return "executed";
  const status = assessment?.status || "draft";
  const objectivesState = assessment?.objectives_state || assessment?.objectivesState;
  if (status === "draft" && objectivesState === "extracting") return "extracting";
  if (status === "draft" && objectivesState === "failed") return "failed";
  return status;
};
