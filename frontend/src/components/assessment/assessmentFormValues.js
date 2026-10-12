// Initial values for the shared create/edit assessment form.

export const NEW_BLOCK = {
  question_type: "multiple_choice",
  question_count: 5,
  duration_per_question: 60,
  num_options: 4,
  positive_marks: 1,
  negative_marks: 0,
};

/** Values coming from the API, normalized for the form. */
export const formValuesFromAssessment = (assessment) => ({
  title: assessment?.title || "",
  prompt: assessment?.prompt || "",
  links: Array.isArray(assessment?.external_links) && assessment.external_links.length ? assessment.external_links : [""],
  resourceIds: Array.isArray(assessment?.resources) ? assessment.resources.map((r) => r.id).filter(Number.isInteger) : [],
  blocks:
    Array.isArray(assessment?.question_blocks) && assessment.question_blocks.length
      ? assessment.question_blocks.map((b) => ({
          question_type: b.question_type,
          question_count: Number(b.question_count),
          duration_per_question: Number(b.duration_per_question),
          num_options: b.num_options === null || b.num_options === undefined ? 4 : Number(b.num_options),
          positive_marks: Number(b.positive_marks ?? 1),
          negative_marks: Number(b.negative_marks ?? 0),
        }))
      : [{ ...NEW_BLOCK }],
});
