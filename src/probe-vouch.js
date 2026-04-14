require("dotenv").config();

// Bypass the broken SDK and call Vouch's API directly
// The SDK just POSTs to https://app.getvouch.io/api/proof-request
(async () => {
  console.log("--- Vouch API Probe (direct, no SDK) ---");
  console.log("Customer ID:", process.env.VOUCH_CUSTOMER_ID);
  console.log("API Key:", process.env.VOUCH_API_KEY?.slice(0, 10) + "...");
  console.log();

  // Encode inputs as base64 JSON (like the SDK does)
  const inputs = { ig_handle: "test_handle" };
  const encodedInputs = Buffer.from(JSON.stringify(inputs)).toString("base64");

  const body = {
    customerId: process.env.VOUCH_CUSTOMER_ID,
    datasourceId: "687d6f6f-5346-4fb1-9552-222d4a225451", // Instagram from docs
    redirectBackUrl: "https://example.com/done",
    webhookUrl: "https://example.com/api/webhook",
    inputs: encodedInputs,
    metadata: "discord-user-123",
  };

  console.log("Request body:", JSON.stringify(body, null, 2));
  console.log();

  try {
    const res = await fetch("https://app.getvouch.io/api/proof-request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VOUCH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    console.log("Status:", res.status, res.statusText);
    console.log("Headers:");
    for (const [k, v] of res.headers.entries()) console.log(`  ${k}: ${v}`);
    console.log();

    const text = await res.text();
    console.log("Body:", text);

    try {
      const json = JSON.parse(text);
      console.log("\nParsed JSON:", JSON.stringify(json, null, 2));
    } catch {}
  } catch (err) {
    console.error("Request failed:", err);
  }
})();
