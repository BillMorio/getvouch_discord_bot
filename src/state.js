// In-memory map of submission_id -> submission_token.
// Lives for the bot process lifetime. Lost on restart.
// Used so clippers can run /upload-proof without passing the token manually.
const submissionTokens = new Map();

function rememberToken(submissionId, token) {
  if (!submissionId || !token) return;
  submissionTokens.set(String(submissionId), token);
}

function lookupToken(submissionId) {
  return submissionTokens.get(String(submissionId)) || null;
}

module.exports = { rememberToken, lookupToken };
