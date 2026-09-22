import "dotenv/config";
import { Configuration, SubAccountsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const subAccountsApi = new SubAccountsApi(config);

// Sub-accounts let you isolate customers or projects with their own API keys and credits.
// Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.
const createEnabled = process.env.CREATE_SUBACCOUNT === "true";
const subEmail = process.env.SUBACCOUNT_EMAIL || `sub-${Date.now()}@example.com`;

const fail = (step, err) => {
  console.error(`Error (${step}):`, err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
};

try {
  const { data } = await subAccountsApi.subaccountsGet(20, 0);
  console.log(`Sub-accounts (${data.length}):`);
  for (const s of data) {
    console.log(` - ${s.Email} status=${s.Status} credits=${s.EmailCredits} sent=${s.TotalEmailsSent}`);
  }
} catch (err) {
  fail("list sub-accounts", err);
}

if (!createEnabled) {
  console.log("\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.");
  process.exit(0);
}

try {
  const { data } = await subAccountsApi.subaccountsPost({
    Email: subEmail,
    Password: `Tmp-${Math.random().toString(36).slice(2)}-Aa1!`,
    SendActivation: false,
  });
  console.log("\nSub-account created:", data.Email);

  await subAccountsApi.subaccountsByEmailCreditsPatch(subEmail, { Credits: 1000, Notes: "Initial allocation" });
  console.log("Assigned 1000 credits to", subEmail);

  const { data: key } = await subAccountsApi.subaccountsByEmailApikeyGet(subEmail);
  console.log("Sub-account API key retrieved (length):", key.length);
} catch (err) {
  fail("create sub-account", err);
}
