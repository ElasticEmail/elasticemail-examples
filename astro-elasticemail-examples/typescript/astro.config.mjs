import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Elastic Email posts inbound notifications form-encoded without an Origin header.
  // Astro's default CSRF check would reject them, so it is turned off here. The handlers
  // verify X-ElasticEmail-Signature (signed webhooks) or the shared ?token= instead.
  security: { checkOrigin: false },
});
