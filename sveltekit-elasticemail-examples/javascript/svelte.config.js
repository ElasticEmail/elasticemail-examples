import adapter from "@sveltejs/adapter-auto";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    // Elastic Email posts inbound notifications form-encoded without an Origin header.
    // SvelteKit's CSRF check would reject those with 403 before any handler runs, so it is off here.
    // The handlers verify X-ElasticEmail-Signature (signed webhooks) or the shared ?token= instead. Re-enable it if you add form actions.
    csrf: { checkOrigin: false },
  },
};

export default config;
