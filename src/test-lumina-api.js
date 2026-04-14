require("dotenv").config();

const BASE = "https://clippers-poc-git-artur-backend-tenant-vlayer.vercel.app/api/external/v1";
const TOKEN = "ext_-UbNMzyqPNJMQrgaP9KSd5FCdDEMJs04";

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }

  console.log(`\n--- ${method} ${path} ---`);
  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, data: json };
}

(async () => {
  // 1. List campaigns
  console.log("\n========== 1. LIST CAMPAIGNS ==========");
  const campaigns = await api("GET", "/campaigns");

  // 2. Get single campaign (use first one if available)
  console.log("\n========== 2. GET SINGLE CAMPAIGN ==========");
  let campaignId;
  const campaignList = campaigns.data?.campaigns || campaigns.data;
  if (Array.isArray(campaignList) && campaignList.length > 0) {
    campaignId = campaignList[0].id;
    await api("GET", `/campaigns/${campaignId}`);
  } else {
    console.log("No campaigns found, skipping...");
  }

  // 3. Submit single post
  console.log("\n========== 3. SUBMIT SINGLE POST ==========");
  let submissionId;
  if (campaignId) {
    const sub = await api("POST", "/submissions", {
      campaign_id: campaignId,
      clipper_email: "testclipper@example.com",
      post_url: "https://www.instagram.com/reel/TEST123456/",
    });
    if (sub.data?.submission_id) {
      submissionId = sub.data.submission_id;
    }
  } else {
    console.log("No campaign ID, skipping...");
  }

  // 4. Bulk submit
  console.log("\n========== 4. BULK SUBMIT ==========");
  if (campaignId) {
    await api("POST", "/submissions/bulk", {
      campaign_id: campaignId,
      clipper_email: "testclipper@example.com",
      post_urls: [
        "https://www.tiktok.com/@testuser/video/111111111",
        "https://www.youtube.com/shorts/TESTYT123",
        "https://www.instagram.com/reel/TEST123456/", // duplicate
      ],
    });
  }

  // 5. Get submission status
  console.log("\n========== 5. GET SUBMISSION STATUS ==========");
  if (submissionId) {
    await api("GET", `/submissions/${submissionId}`);
  } else {
    console.log("No submission ID, skipping...");
  }

  // 6. Update verification status
  console.log("\n========== 6. PATCH VERIFICATION ==========");
  if (submissionId) {
    await api("PATCH", `/submissions/${submissionId}/verification`, {
      verification_status: "verified",
      verification_request_id: "test-request-123",
      outputs: {
        handle: "testuser",
        follower_count: "15000",
        country: "US",
      },
    });
  } else {
    console.log("No submission ID, skipping...");
  }

  // 7. List clipper submissions
  console.log("\n========== 7. CLIPPER SUBMISSIONS ==========");
  await api("GET", "/clippers/testclipper@example.com/submissions");

  // 8. Clipper stats
  console.log("\n========== 8. CLIPPER STATS ==========");
  await api("GET", "/clippers/testclipper@example.com/stats");

  console.log("\n========== DONE ==========");
})();
