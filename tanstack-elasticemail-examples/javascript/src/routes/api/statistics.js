// GET /api/statistics
import { createFileRoute } from "@tanstack/react-router";
import { apiError, json, query, statisticsApi } from "../../lib/elasticemail";

// Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
const iso = (d) => d.toISOString().slice(0, 19);

export const Route = createFileRoute("/api/statistics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const days = Math.min(Math.max(Number(query(request).get("days")) || 30, 1), 365);
        const to = new Date();
        const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

        try {
          const { data } = await statisticsApi.statisticsGet(iso(from), iso(to));
          return json({
            from: iso(from),
            to: iso(to),
            Recipients: data.Recipients,
            EmailTotal: data.EmailTotal,
            Delivered: data.Delivered,
            Bounced: data.Bounced,
            InProgress: data.InProgress,
            Opened: data.Opened,
            Clicked: data.Clicked,
            Unsubscribed: data.Unsubscribed,
            Complaints: data.Complaints,
          });
        } catch (err) {
          const { status, message: error } = apiError(err);
          return json({ error }, status);
        }
      },
    },
  },
});
