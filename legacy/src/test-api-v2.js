const BASE = "https://lumina-clippers-api.onrender.com";

async function call(method, path, body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  console.log(`\n--- ${method} ${path} ---`);
  console.log(`Status: ${res.status}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 800));
  return { status: res.status, data };
}

(async () => {
  console.log("\n========== 1. LIST OPEN CAMPAIGNS ==========");
  const list = await call("GET", "/api/discord/campaigns");

  const first = Array.isArray(list.data) ? list.data[0] : (list.data?.campaigns || [])[0];
  const campaignId = first?.id;

  if (campaignId) {
    console.log("\n========== 2. GET SINGLE CAMPAIGN ==========");
    await call("GET", `/api/discord/campaigns/${campaignId}`);
  }

  console.log("\n========== 3. SUBMIT CLIP ==========");
  let submissionId, submissionToken;
  if (campaignId) {
    const sub = await call("POST", "/api/discord/submit", {
      campaign_id: campaignId,
      clipper_email: "test-v2@example.com",
      post_url: `https://www.instagram.com/reel/TESTV2${Date.now()}/`,
      discord_user_id: "123456789012345678",
    });
    submissionId = sub.data?.submission_id;
    submissionToken = sub.data?.submission_token;
  }

  if (submissionId) {
    console.log("\n========== 4. GET SUBMISSION STATUS ==========");
    await call("GET", `/api/discord/submission/${submissionId}`);
  }

  console.log("\n========== 5. CLIPPER STATS ==========");
  await call("GET", "/api/discord/clipper/test-v2%40example.com/stats");

  console.log("\n========== 6. ALL CAMPAIGNS (open + closed) ==========");
  await call("GET", "/api/campaigns");

  if (submissionId && submissionToken) {
    console.log("\n========== 7. VERIFICATION STATUS ==========");
    await call("GET", `/api/submissions/${submissionId}/verification-status?token=${submissionToken}`);
  } else {
    console.log("\n========== 7. VERIFICATION STATUS - skipped (no token) ==========");
  }

  console.log("\n========== 8. UPLOAD VERIFICATION — skipped (requires video file) ==========");

  console.log("\n========== DONE ==========");
})();
