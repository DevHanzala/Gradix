export const validateStudentAnalyticsQuery = (params) => {
  const errors = [];

  if (!params.studentId || !Number.isInteger(params.studentId)) {
    errors.push('Student ID must be a valid integer');
  }

  return errors;
};

export const validatePerformanceTimeRange = (timeRange) => {
  const validRanges = ['week', 'month', 'year', 'all'];
  
  if (timeRange && !validRanges.includes(timeRange)) {
    return [`Time range must be one of: ${validRanges.join(', ')}`];
  }

  return [];
};

export const validateAssessmentAnalyticsQuery = (params) => {
  const errors = [];

  if (!params.studentId || !Number.isInteger(params.studentId)) {
    errors.push('Student ID must be a valid integer');
  }

  if (!params.assessmentId || !Number.isInteger(params.assessmentId)) {
    errors.push('Assessment ID must be a valid integer');
  }

  return errors;
};

