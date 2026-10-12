export const validateResourceData = (data) => {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.push('Resource name is required and must be a non-empty string');
  }

  if (!data.content_type || !['file', 'link'].includes(data.content_type)) {
    errors.push('Content type must be either "file" or "link"');
  }

  if (data.visibility && !['private', 'public'].includes(data.visibility)) {
    errors.push('Visibility must be either "private" or "public"');
  }

  if (!data.uploaded_by || !Number.isInteger(data.uploaded_by)) {
    errors.push('Uploader ID is required and must be an integer');
  }

  if (data.file_size && (!Number.isInteger(data.file_size) || data.file_size < 0)) {
    errors.push('File size must be a non-negative integer');
  }

  return errors;
};

export const validateResourceUpdate = (data) => {
  const errors = [];

  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim() === '')) {
    errors.push('Resource name must be a non-empty string if provided');
  }

  if (data.visibility !== undefined && !['private', 'public'].includes(data.visibility)) {
    errors.push('Visibility must be either "private" or "public" if provided');
  }

  return errors;
};

export const validateResourceLink = (assessmentId, resourceId) => {
  const errors = [];

  if (!assessmentId || !Number.isInteger(assessmentId)) {
    errors.push('Assessment ID must be a valid integer');
  }

  if (!resourceId || !Number.isInteger(resourceId)) {
    errors.push('Resource ID must be a valid integer');
  }

  return errors;
};

