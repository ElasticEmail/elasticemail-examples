import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Elastic Email posts webhook and inbound notifications form-encoded without an Origin
  // header. Astro's default CSRF check would reject them, so it is turned off here and
  // the handlers verify the shared ?token= instead.
  security: { checkOrigin: false },
});
