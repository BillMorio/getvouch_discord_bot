import "dotenv/config";
import { Vouch } from "@getvouch/sdk/dist/lib/vouch.js";

console.log("--- Vouch SDK Probe ---");
console.log("Customer ID:", process.env.VOUCH_CUSTOMER_ID);
console.log("API Key length:", process.env.VOUCH_API_KEY?.length);
console.log();

const vouch = new Vouch({
  customerId: process.env.VOUCH_CUSTOMER_ID,
  apiKey: process.env.VOUCH_API_KEY,
});

console.log("Vouch instance prototype methods:");
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(vouch)));
console.log();

console.log("Vouch instance keys:");
console.log(Object.keys(vouch));
console.log();

console.log("--- Calling getDataSourceUrl (Instagram from docs example) ---");
try {
  const result = await vouch.getDataSourceUrl({
    datasourceId: "687d6f6f-5346-4fb1-9552-222d4a225451",
    inputs: { ig_handle: "test_handle" },
    redirectBackUrl: "http://localhost:3000/done",
    webhookUrl: "http://localhost:3000/api/webhook",
    metadata: "discord-user-123",
  });
  console.log("SUCCESS:", JSON.stringify(result, null, 2));
} catch (err) {
  console.log("ERROR message:", err.message);
  console.log("ERROR name:", err.name);
  if (err.response) {
    console.log("Response status:", err.response.status);
    console.log("Response body:", err.response.data);
  }
  console.log("Full error:", err);
}
