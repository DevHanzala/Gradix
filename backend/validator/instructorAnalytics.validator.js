export const validateAnalyticsQuery = (params) => {
  const errors = [];

  if (!params.instructorId || !Number.isInteger(params.instructorId)) {
    errors.push('Instructor ID must be a valid integer');
  }

  return errors;
};

export const validateAssessmentStudentsQuery = (params) => {
  const errors = [];

  if (!params.assessmentId || !Number.isInteger(params.assessmentId)) {
    errors.push('Assessment ID must be a valid integer');
  }

  if (!params.instructorId || !Number.isInteger(params.instructorId)) {
    errors.push('Instructor ID must be a valid integer');
  }

  return errors;
};

export const validateStudentAttemptQuery = (params) => {
  const errors = [];

  if (!params.assessmentId || !Number.isInteger(params.assessmentId)) {
    errors.push('Assessment ID must be a valid integer');
  }

  if (!params.studentId || !Number.isInteger(params.studentId)) {
    errors.push('Student ID must be a valid integer');
  }

  if (!params.instructorId || !Number.isInteger(params.instructorId)) {
    errors.push('Instructor ID must be a valid integer');
  }

  return errors;
};

