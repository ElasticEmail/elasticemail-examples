import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: { port: 3000 },
  // The router plugin generates src/routeTree.gen.ts (with a type-only footer) even in a
  // JavaScript project. Vite compiles it like any other file, so it is left as is.
  plugins: [tanstackStart(), nitro(), viteReact()],
});
