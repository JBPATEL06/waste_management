export function formatApiError(error, fallback = 'Request failed') {
  const isValidationError =
    Number(error?.status || error?.response?.status) === 422 ||
    error?.code === 'VALIDATION_FAILED';
  const fieldErrors = Object.entries(error?.fieldErrors || {}).slice(0, 3);

  if (isValidationError && fieldErrors.length > 0) {
    return fieldErrors.map(([field, message]) => `${field}: ${message}`).join('\n');
  }

  return error?.message || fallback;
}
