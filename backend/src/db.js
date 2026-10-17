function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  err.errCode = code;
  return err;
}

// Unwraps a Supabase result or throws a friendly error (details go to the server log only).
function must(result, what = 'query') {
  if (result && result.error) {
    console.error(`[db] ${what} failed:`, result.error.message || result.error);
    throw httpError(500, 'Something went wrong on our side. Please try again.');
  }
  return result ? result.data : null;
}

module.exports = { httpError, must };
