<script>
  import "../app.css";

  let { children } = $props();

  const nav = [
    { href: "/send-email", label: "Send" },
    { href: "/attachments", label: "Attachments" },
    { href: "/templates", label: "Templates" },
    { href: "/scheduling", label: "Scheduling" },
    { href: "/contacts", label: "Contacts" },
    { href: "/domains", label: "Domains" },
    { href: "/statistics", label: "Statistics" },
    { href: "/webhooks", label: "Webhooks" },
    { href: "/inbound", label: "Inbound" },
    { href: "/double-optin", label: "Double opt-in" },
  ];
</script>

<svelte:head>
  <title>Elastic Email Examples - SvelteKit + JavaScript</title>
  <meta name="description" content="Examples for sending and managing email with Elastic Email and SvelteKit" />
</svelte:head>

<nav class="nav">
  <a href="/" class="nav-brand">Elastic Email Examples</a>
  <div class="nav-links">
    {#each nav as item (item.href)}
      <a href={item.href}>{item.label}</a>
    {/each}
  </div>
</nav>

{@render children()}
