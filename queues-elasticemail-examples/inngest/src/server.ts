import "dotenv/config";
import { createServer } from "node:http";
import { serve } from "inngest/node";
import { inngest } from "./client.js";
import { functions } from "./functions.js";

// Inngest calls this endpoint to run each step. Your server does the sending;
// Inngest keeps the queue, the retry schedule and the run history.
const inngestHandler = serve({ client: inngest, functions });

const server = createServer((req, res) => {
  const path = req.url?.split("?")[0];
  if (path === "/api/inngest") return inngestHandler(req, res);
  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }
  res.writeHead(404).end();
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Inngest functions served at http://localhost:${port}/api/inngest`);
});
