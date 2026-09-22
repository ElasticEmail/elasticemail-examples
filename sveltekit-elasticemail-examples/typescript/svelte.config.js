import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // Elastic Email posts webhook and inbound notifications form-encoded without an Origin header.
    // SvelteKit's CSRF check would reject those with 403 before any handler runs, so it is off here.
    // The handlers verify the shared ?token= instead. Re-enable it if you add form actions.
    csrf: { checkOrigin: false },
  },
};

export default config;
