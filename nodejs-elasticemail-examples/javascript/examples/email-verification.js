import "dotenv/config";
import { Configuration, VerificationsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const verificationsApi = new VerificationsApi(config);

// Usage: node examples/email-verification.js someone@example.com
const email = process.argv[2] || process.env.EMAIL_TO || "you@yourdomain.com";

// Email verification is a paid feature. Accounts without it get a 4xx here.
try {
  await verificationsApi.verificationsByEmailPost(email);
  const { data } = await verificationsApi.verificationsByEmailGet(email);

  console.log("=== Verification result ===");
  console.log("Email:      ", data.Email);
  console.log("Result:     ", data.Result);
  console.log("Reason:     ", data.Reason ?? "");
  console.log("Disposable: ", data.Disposable);
  console.log("Role:       ", data.Role);
  if (data.SuggestedSpelling) console.log("Did you mean:", data.SuggestedSpelling);
} catch (err) {
  console.error("Error verifying email:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
