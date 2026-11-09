const BASE_URL =
  process.env.LUMINA_API_URL || "https://lumina-clippers-api.onrender.com";

// Shared secret so only this bot can use /api/discord/* (API checks X-Discord-Bot-Key
// against its DISCORD_BOT_KEY). Set LUMINA_DISCORD_BOT_KEY on the bot's Render service.
const BOT_KEY = (process.env.LUMINA_DISCORD_BOT_KEY || "").trim();
if (!BOT_KEY) console.warn("[api] LUMINA_DISCORD_BOT_KEY is not set; /api/discord calls will be refused once the API enforces the key");

function apiFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (BOT_KEY && url.includes("/api/discord/")) headers["X-Discord-Bot-Key"] = BOT_KEY;
  return fetch(url, { ...opts, headers });
}

async function listCampaigns() {
  const r = await apiFetch(`${BASE_URL}/api/discord/campaigns`);
  if (!r.ok) throw new Error(`listCampaigns ${r.status}`);
  return r.json();
}

async function getCampaign(id) {
  const r = await apiFetch(`${BASE_URL}/api/discord/campaigns/${id}`);
  if (!r.ok) throw new Error(`getCampaign ${r.status}`);
  return r.json();
}

async function submitClip({ campaign_id, clipper_email, post_url, discord_user_id }) {
  const r = await apiFetch(`${BASE_URL}/api/discord/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaign_id, clipper_email, post_url, discord_user_id }),
  });
  return r.json();
}

async function getClipperStats(email) {
  const r = await apiFetch(`${BASE_URL}/api/discord/clipper/${encodeURIComponent(email)}/stats`);
  if (!r.ok) throw new Error(`getClipperStats ${r.status}`);
  return r.json();
}

async function getSubmissionStatus(id) {
  const r = await apiFetch(`${BASE_URL}/api/discord/submission/${id}`);
  if (!r.ok) throw new Error(`getSubmissionStatus ${r.status}`);
  return r.json();
}

async function getVerificationStatus(submissionId, token) {
  const url = `${BASE_URL}/api/submissions/${submissionId}/verification-status?token=${encodeURIComponent(token)}`;
  const r = await apiFetch(url);
  if (!r.ok) throw new Error(`getVerificationStatus ${r.status}`);
  return r.json();
}

async function listPublicCampaigns() {
  const r = await apiFetch(`${BASE_URL}/api/public/campaigns`);
  if (!r.ok) throw new Error(`listPublicCampaigns ${r.status}`);
  return r.json();
}

async function getPaymentMethod(email) {
  const r = await apiFetch(`${BASE_URL}/api/discord/clipper/${encodeURIComponent(email)}/payment-method`);
  if (!r.ok) throw new Error(`getPaymentMethod ${r.status}`);
  return r.json();
}

async function setPaymentMethod(email, body) {
  const r = await apiFetch(`${BASE_URL}/api/discord/clipper/${encodeURIComponent(email)}/payment-method`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`setPaymentMethod ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

async function listUserSubmissions(discordUserId, { limit, offset, status } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  if (offset) qs.set("offset", String(offset));
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs}` : "";
  const r = await apiFetch(
    `${BASE_URL}/api/discord/user/${encodeURIComponent(discordUserId)}/submissions${suffix}`
  );
  if (r.status === 404) return { total: 0, submissions: [] };
  if (!r.ok) throw new Error(`listUserSubmissions ${r.status}`);
  return r.json();
}

async function listClipperSubmissions(email, { limit, offset, status } = {}) {
  const qs = new URLSearchParams();
  if (limit) qs.set("limit", String(limit));
  if (offset) qs.set("offset", String(offset));
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs}` : "";
  const r = await apiFetch(
    `${BASE_URL}/api/discord/clipper/${encodeURIComponent(email)}/submissions${suffix}`
  );
  if (r.status === 404) return { total: 0, submissions: [] };
  if (!r.ok) throw new Error(`listClipperSubmissions ${r.status}`);
  return r.json();
}

async function claimPayment(submissionId, clipperEmail) {
  const r = await apiFetch(`${BASE_URL}/api/discord/submission/${submissionId}/claim-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clipper_email: clipperEmail }),
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

module.exports = {
  BASE_URL,
  listCampaigns,
  getCampaign,
  submitClip,
  getClipperStats,
  getSubmissionStatus,
  getVerificationStatus,
  listPublicCampaigns,
  getPaymentMethod,
  setPaymentMethod,
  listUserSubmissions,
  listClipperSubmissions,
  claimPayment,
};
