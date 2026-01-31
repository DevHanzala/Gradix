export const validateAssessmentPayload = (body) => {
  let { prompt, title, question_blocks } = body;

  if (!prompt?.trim()) {
    throw new Error('Prompt required');
  }

  if (title && !title.trim()) {
    throw new Error('Invalid title');
  }

  for (const block of question_blocks || []) {
    if (block.question_count < 1) throw new Error('Question count ≥ 1');
    if (block.duration_per_question < 30) throw new Error('Duration ≥ 30s');
  }
};

export const validateAssessmentData = (data) => {
  const errors = [];

  if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
    errors.push('Title is required and must be a non-empty string');
  }

  if (data.instructor_id && !Number.isInteger(data.instructor_id)) {
    errors.push('Instructor ID must be an integer');
  }

  if (data.external_links && !Array.isArray(data.external_links)) {
    errors.push('External links must be an array');
  }

  return errors;
};

export const validateQuestionBlockData = (data) => {
  const errors = [];
  const validTypes = ['multiple_choice', 'true_false', 'short_answer'];

  if (!data.question_type || !validTypes.includes(data.question_type)) {
    errors.push(`Question type must be one of: ${validTypes.join(', ')}`);
  }

  if (!data.question_count || !Number.isInteger(data.question_count) || data.question_count < 1) {
    errors.push('Question count must be a positive integer');
  }

  if (data.duration_per_question && (!Number.isInteger(data.duration_per_question) || data.duration_per_question < 0)) {
    errors.push('Duration per question must be a non-negative integer');
  }

  if (data.question_type === 'multiple_choice' && (!data.num_options || data.num_options < 2)) {
    errors.push('Multiple choice questions must have at least 2 options');
  }

  return errors;
};


