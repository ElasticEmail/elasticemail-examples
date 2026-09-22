import { Configuration, StatisticsApi } from "@elasticemail/elasticemail-client-ts-axios";

const config = new Configuration({ apiKey: process.env.ELASTICEMAIL_API_KEY });
const statisticsApi = new StatisticsApi(config);

// Account-wide sending statistics for the last 30 days.
// Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
const iso = (d) => d.toISOString().slice(0, 19);
const to = new Date();
const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

try {
  const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));

  console.log(`=== Statistics ${iso(from)} to ${iso(to)} ===`);
  console.log("Recipients:   ", data.Recipients);
  console.log("Emails total: ", data.EmailTotal);
  console.log("Delivered:    ", data.Delivered);
  console.log("Bounced:      ", data.Bounced);
  console.log("In progress:  ", data.InProgress);
  console.log("Opened:       ", data.Opened);
  console.log("Clicked:      ", data.Clicked);
  console.log("Unsubscribed: ", data.Unsubscribed);
  console.log("Complaints:   ", data.Complaints);
} catch (err) {
  console.error("Error fetching statistics:", err.response?.status, err.response?.data ?? err.message);
  process.exit(1);
}
