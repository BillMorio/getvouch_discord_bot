const BASE_URL = process.env.API_BASE_URL;
const TOKEN = process.env.API_TOKEN;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function fetchCampaigns() {
  const res = await fetch(`${BASE_URL}/campaigns`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch campaigns: ${res.status}`);
  const data = await res.json();
  return data.campaigns || data;
}

async function fetchCampaign(campaignId) {
  const res = await fetch(`${BASE_URL}/campaigns/${campaignId}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch campaign ${campaignId}: ${res.status}`);
  return res.json();
}

async function submitEntry({ campaign_id, clipper_email, post_url }) {
  const res = await fetch(`${BASE_URL}/submissions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ campaign_id, clipper_email, post_url }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { status: "error", detail: data.detail || data.message || `Error ${res.status}` };
  }
  return data;
}

async function submitBulk({ campaign_id, clipper_email, post_urls }) {
  const res = await fetch(`${BASE_URL}/submissions/bulk`, {
    method: "POST",
    headers,
    body: JSON.stringify({ campaign_id, clipper_email, post_urls }),
  });
  if (!res.ok) throw new Error(`Bulk submit failed: ${res.status}`);
  return res.json();
}

async function fetchSubmission(submissionId) {
  const res = await fetch(`${BASE_URL}/submissions/${submissionId}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch submission ${submissionId}: ${res.status}`);
  return res.json();
}

async function patchVerification(submissionId, { verification_status, verification_request_id, outputs }) {
  const res = await fetch(`${BASE_URL}/submissions/${submissionId}/verification`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ verification_status, verification_request_id, outputs }),
  });
  if (!res.ok) throw new Error(`Failed to patch verification: ${res.status}`);
  return res.json();
}

async function fetchClipperSubmissions(email) {
  const res = await fetch(`${BASE_URL}/clippers/${encodeURIComponent(email)}/submissions`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch submissions for ${email}: ${res.status}`);
  return res.json();
}

async function fetchClipperStats(email) {
  const res = await fetch(`${BASE_URL}/clippers/${encodeURIComponent(email)}/stats`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch stats for ${email}: ${res.status}`);
  return res.json();
}

module.exports = {
  fetchCampaigns,
  fetchCampaign,
  submitEntry,
  submitBulk,
  fetchSubmission,
  patchVerification,
  fetchClipperSubmissions,
  fetchClipperStats,
};
