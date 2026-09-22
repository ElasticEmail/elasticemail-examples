import { Configuration, SuppressionsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const suppressionsApi = new SuppressionsApi(config);

const email = process.argv[2] || "suppressed@example.com";

const fail = (step, err) => {
  console.error(`Error (${step}):`, err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
};

// Suppressions are split into unsubscribes, bounces and complaints.
// Adding to any list stops future sends to that address.
try {
  await suppressionsApi.suppressionsUnsubscribesPost([email]);
  console.log("Added to unsubscribes:", email);
} catch (err) {
  fail("add unsubscribe", err);
}

try {
  const { data } = await suppressionsApi.suppressionsByEmailGet(email);
  console.log("Suppression:", { Email: data.Email, Reason: data.FriendlyErrorMessage, DateUpdated: data.DateUpdated });
} catch (err) {
  fail("get suppression", err);
}

try {
  const { data } = await suppressionsApi.suppressionsGet(10, 0);
  console.log(`\nAll suppressions (first ${data.length}):`);
  for (const s of data) console.log(" -", s.Email, s.FriendlyErrorMessage ?? "");
} catch (err) {
  fail("list suppressions", err);
}

// Remove it again so the address can receive email
try {
  await suppressionsApi.suppressionsByEmailDelete(email);
  console.log("\nRemoved from suppressions:", email);
} catch (err) {
  fail("delete suppression", err);
}
