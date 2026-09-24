#!/usr/bin/env node
// Regenerates the machine-readable files for LLMs and coding agents:
//   examples.json  - use case x stack -> source files
//   llms-full.txt  - every guide and quickstart in one file
//   the "**Versions:**" line in every stack README
// Run from the repository root after adding a stack or an example:
//   node scripts/build-agent-files.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "https://github.com/ElasticEmail/elasticemail-examples";
const SDK_VERSION = "4.2.0";
const TS_SDK = "@elasticemail/elasticemail-client-ts-axios";

// Each pattern runs against a normalized path: camelCase split, lowercased,
// every run of non-alphanumerics collapsed to "-".
const USE_CASES = [
  { id: "basic-send", title: "Basic send", doc: "docs/sending-email.md",
    pattern: /(basic-send|send-basic|(api|functions|email)-send-(route-|server-|post-|index-)?(js|ts|mts)$)/ },
  { id: "batch-send", title: "Batch send with merge fields", doc: "docs/sending-email.md", pattern: /(batch-send|send-batch)/ },
  { id: "attachments", title: "File attachments", doc: "docs/attachments.md", pattern: /(with-attachments|send-attachment|attachments-send-php$)/ },
  { id: "cid-attachments", title: "Inline (CID) images", doc: "docs/attachments.md", pattern: /(cid-attachments|send-cid)/ },
  { id: "templates", title: "Hosted templates", doc: "docs/templates.md", pattern: /(with-template|send-template|templates-send-php$)/ },
  { id: "scheduled-send", title: "Scheduled send", doc: "docs/sending-email.md", pattern: /(scheduled-send|send-scheduled|scheduling-send)/ },
  { id: "prevent-threading", title: "Prevent Gmail threading", doc: "docs/sending-email.md", pattern: /prevent-threading/ },
  { id: "email-status", title: "Delivery status lookup", doc: "docs/sending-email.md", pattern: /(email-status|send-status)/ },
  { id: "webhooks", title: "Webhook events", doc: "docs/webhooks.md", pattern: /webhooks?(-|$)/, exclude: /optin/ },
  { id: "inbound", title: "Inbound email routing", doc: "docs/inbound-email.md", pattern: /inbound/ },
  { id: "contacts", title: "Contacts and lists", doc: "docs/contacts-and-lists.md", pattern: /(contacts(-|$)|contact-controller)/ },
  { id: "double-optin", title: "Double opt-in", doc: "docs/double-opt-in.md", pattern: /double-optin/ },
  { id: "suppressions", title: "Suppressions", doc: "docs/suppressions.md", pattern: /suppressions/ },
  { id: "domains", title: "Sending domains (SPF, DKIM, DMARC)", doc: "docs/domains-and-deliverability.md", pattern: /(domains(-|$)|domain-controller)/ },
  { id: "statistics", title: "Delivery statistics", doc: "docs/account.md", pattern: /statistics/ },
  { id: "email-verification", title: "Email address verification", doc: "docs/account.md", pattern: /(email-verification|verification-verify)/ },
  { id: "sub-accounts", title: "Sub-accounts", doc: "docs/account.md", pattern: /(sub-accounts|subaccounts)/ },
];

// UI pages that call the API routes, not examples themselves.
const UI_FILE = /\.(tsx|jsx|vue|svelte|astro)$/;

const ts = (runtime, frameworks) => ({ language: "TypeScript, JavaScript", sdk: `${TS_SDK}@${SDK_VERSION}`, runtime, frameworks });
const STACKS = [
  { id: "nextjs", name: "Next.js", dir: "nextjs-elasticemail-examples", ...ts("Node.js 18.18+", ["Next.js 15", "React 19"]),
    readme: "nextjs-elasticemail-examples/typescript/README.md",
    versionReadmes: ["nextjs-elasticemail-examples/typescript/README.md", "nextjs-elasticemail-examples/javascript/README.md"],
    apps: ["nextjs-elasticemail-examples/typescript", "nextjs-elasticemail-examples/javascript"] },
  { id: "php", name: "PHP", dir: "php-elasticemail-examples", language: "PHP", sdk: `elasticemail/elasticemail-php@${SDK_VERSION}`, runtime: "PHP 8.1+", frameworks: ["Slim 4", "Symfony 6.4/7"],
    apps: ["php-elasticemail-examples/src/slim_app.php", "php-elasticemail-examples/symfony_app"] },
  { id: "laravel", name: "Laravel", dir: "laravel-elasticemail-examples", language: "PHP", sdk: `elasticemail/elasticemail-php@${SDK_VERSION}`, runtime: "PHP 8.2+", frameworks: ["Laravel 11"],
    apps: ["laravel-elasticemail-examples/routes/api.php"],
    // One controller holds every send variant; see routes/api.php.
    extra: Object.fromEntries(["basic-send", "batch-send", "attachments", "cid-attachments", "templates", "scheduled-send", "prevent-threading"]
      .map((id) => [id, ["laravel-elasticemail-examples/app/Http/Controllers/EmailController.php"]])) },
  { id: "python", name: "Python", dir: "python-elasticemail-examples", language: "Python", sdk: `ElasticEmail==${SDK_VERSION} (PyPI)`, runtime: "Python 3.9+", frameworks: ["Flask", "FastAPI", "Django"],
    apps: ["python-elasticemail-examples/examples/flask_app.py", "python-elasticemail-examples/examples/fastapi_app.py", "python-elasticemail-examples/django_app"] },
  { id: "ruby", name: "Ruby", dir: "ruby-elasticemail-examples", language: "Ruby", sdk: `ElasticEmail ~> 4.2 (RubyGems)`, runtime: "Ruby 3.1+", frameworks: ["Sinatra 4", "Rails 7.2"],
    apps: ["ruby-elasticemail-examples/sinatra_app/app.rb", "ruby-elasticemail-examples/rails_app"] },
  { id: "go", name: "Go", dir: "go-elasticemail-examples", language: "Go", sdk: `github.com/elasticemail/elasticemail-go/v4@v${SDK_VERSION}`, runtime: "Go 1.22+", frameworks: ["Chi 5", "Gin 1.10"],
    apps: ["go-elasticemail-examples/chi_app/main.go", "go-elasticemail-examples/gin_app/main.go"] },
  { id: "java", name: "Java", dir: "java-elasticemail-examples", language: "Java", sdk: `com.github.ElasticEmail:elasticemail-java:${SDK_VERSION} (JitPack)`, runtime: "Java 17+, Maven 3.8+", frameworks: ["Javalin", "Spring Boot 3.4"],
    apps: ["java-elasticemail-examples/javalin_app/App.java", "java-elasticemail-examples/spring_boot_app"] },
  { id: "dotnet", name: ".NET (C#)", dir: "dotnet-elasticemail-examples", language: "C#", sdk: `ElasticEmail ${SDK_VERSION} (NuGet)`, runtime: ".NET 8", frameworks: ["ASP.NET Minimal APIs", "ASP.NET MVC"],
    apps: ["dotnet-elasticemail-examples/MinimalApiApp/Program.cs", "dotnet-elasticemail-examples/MvcApp"] },
  { id: "kotlin", name: "Kotlin", dir: "kotlin-elasticemail-examples", language: "Kotlin", sdk: `com.github.ElasticEmail:elasticemail-java:${SDK_VERSION} (JitPack)`, runtime: "Java 17+, Maven 3.8+", frameworks: ["Kotlin 2.4", "Ktor 3.6"],
    apps: ["kotlin-elasticemail-examples/ktor_app/App.kt"] },
  { id: "rust", name: "Rust", dir: "rust-elasticemail-examples", language: "Rust", sdk: `ElasticEmail (git ElasticEmail/elasticemail-rust, tag ${SDK_VERSION})`, runtime: "Rust 1.75+", frameworks: ["Axum 0.8"],
    apps: ["rust-elasticemail-examples/axum_app/src/main.rs"] },
  { id: "elixir", name: "Elixir", dir: "elixir-elasticemail-examples", language: "Elixir", sdk: "none - REST API v4 called directly with Req 0.5", runtime: "Elixir 1.15+ (OTP 25+)", frameworks: ["Phoenix 1.7"],
    apps: ["elixir-elasticemail-examples/phoenix_app"] },
  { id: "nodejs", name: "Node.js", dir: "nodejs-elasticemail-examples", ...ts("Node.js 20+", ["node:http"]),
    apps: ["nodejs-elasticemail-examples/typescript/src/index.ts", "nodejs-elasticemail-examples/javascript/src/index.js"] },
  // TypeScript only: NestJS relies on decorators.
  { id: "nestjs", name: "NestJS", dir: "nestjs-elasticemail-examples", ...ts("Node.js 20+", ["NestJS 11"]), language: "TypeScript",
    readme: "nestjs-elasticemail-examples/README.md",
    apps: ["nestjs-elasticemail-examples/typescript/src/main.ts"] },
  { id: "fastify", name: "Fastify", dir: "fastify-elasticemail-examples", ...ts("Node.js 20+", ["Fastify 5"]),
    apps: ["fastify-elasticemail-examples/typescript/src/index.ts", "fastify-elasticemail-examples/javascript/src/index.js"] },
  { id: "express", name: "Express", dir: "express-elasticemail-examples", ...ts("Node.js 20+", ["Express 5"]),
    apps: ["express-elasticemail-examples/typescript/src/index.ts", "express-elasticemail-examples/javascript/src/index.js"] },
  { id: "hono", name: "Hono", dir: "hono-elasticemail-examples", ...ts("Node.js 20+", ["Hono 4"]),
    apps: ["hono-elasticemail-examples/typescript/src/index.ts", "hono-elasticemail-examples/javascript/src/index.js"] },
  { id: "bun", name: "Bun", dir: "bun-elasticemail-examples", ...ts("Bun 1.1+", ["Bun.serve()"]),
    apps: ["bun-elasticemail-examples/typescript/src/index.ts", "bun-elasticemail-examples/javascript/src/index.js"] },
  { id: "remix", name: "Remix", dir: "remix-elasticemail-examples", ...ts("Node.js 20+", ["Remix 2"]),
    apps: ["remix-elasticemail-examples/typescript", "remix-elasticemail-examples/javascript"] },
  { id: "nuxt", name: "Nuxt", dir: "nuxt-elasticemail-examples", ...ts("Node.js 20+", ["Nuxt 3"]),
    apps: ["nuxt-elasticemail-examples/typescript", "nuxt-elasticemail-examples/javascript"] },
  { id: "sveltekit", name: "SvelteKit", dir: "sveltekit-elasticemail-examples", ...ts("Node.js 20+", ["SvelteKit 2", "Svelte 5"]),
    apps: ["sveltekit-elasticemail-examples/typescript", "sveltekit-elasticemail-examples/javascript"] },
  { id: "astro", name: "Astro", dir: "astro-elasticemail-examples", ...ts("Node.js 20+", ["Astro 5"]),
    apps: ["astro-elasticemail-examples/typescript", "astro-elasticemail-examples/javascript"] },
  { id: "redwoodjs", name: "RedwoodJS", dir: "redwoodjs-elasticemail-examples", ...ts("Node.js 20, Yarn 4", ["RedwoodJS 8"]),
    apps: ["redwoodjs-elasticemail-examples/typescript", "redwoodjs-elasticemail-examples/javascript"] },
  { id: "tanstack", name: "TanStack Start", dir: "tanstack-elasticemail-examples", ...ts("Node.js 20+", ["TanStack Start"]),
    apps: ["tanstack-elasticemail-examples/typescript", "tanstack-elasticemail-examples/javascript"] },
];

const sl = "serverless-elasticemail-examples";
const serverless = (id, name, runtime, entry) => ({
  id: `serverless-${id}`, name, dir: `${sl}/${id}`, parent: "serverless", readme: `${sl}/${id}/README.md`, quickstart: `${sl}/QUICKSTART.md`,
  language: "TypeScript", sdk: `${TS_SDK}@${SDK_VERSION}`, runtime, frameworks: [name],
  // Single-file handlers serve POST /send and GET /webhook from one entry point.
  extra: entry ? { "basic-send": [`${sl}/${id}/${entry}`], webhooks: [`${sl}/${id}/${entry}`] } : undefined,
});
STACKS.push(
  serverless("cloudflare-workers", "Cloudflare Workers", "workerd (Wrangler 3)", "src/index.ts"),
  serverless("vercel-functions", "Vercel Functions", "Node.js 20+ and Edge runtime"),
  serverless("supabase-edge-functions", "Supabase Edge Functions", "Deno (Supabase CLI 1.200+)"),
  serverless("aws-lambda", "AWS Lambda", "Node.js 20 (AWS SAM)", "src/handler.ts"),
  serverless("deno-deploy", "Deno Deploy", "Deno 2", "main.ts"),
  serverless("netlify-functions", "Netlify Functions", "Node.js 20+ and Edge Functions"),
  serverless("railway", "Railway", "Node.js 20+ (Hono)", "src/index.ts"),
  serverless("encore-ts", "Encore.ts", "Node.js 20+ (Encore 1.45)", "email/send.ts"),
  serverless("firebase-functions", "Firebase Cloud Functions", "Node.js 20 (firebase-functions 6)", "src/index.ts"),
  serverless("azure-functions", "Azure Functions", "Node.js 20 (Azure Functions v4)"),
  serverless("google-cloud-run", "Google Cloud Run", "Node.js 20 (container)", "src/index.ts"),
  serverless("convex", "Convex", "Convex (Node.js actions)", "convex/http.ts"),
);

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n");
const normalize = (p) => p.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase().replace(/[^a-z0-9]+/g, "-");

const stacks = STACKS.map((s) => {
  const files = tracked.filter((f) => f.startsWith(`${s.dir}/`) && !UI_FILE.test(f));
  const useCases = {};
  for (const uc of USE_CASES) {
    const matched = files.filter((f) => {
      const n = normalize(f.slice(s.dir.length + 1));
      return uc.pattern.test(n) && !(uc.exclude && uc.exclude.test(n));
    });
    const all = [...new Set([...matched, ...(s.extra?.[uc.id] ?? [])])].sort();
    if (all.length) useCases[uc.id] = all;
  }
  return {
    id: s.id, name: s.name, ...(s.parent && { parent: s.parent }),
    directory: s.dir, readme: s.readme ?? `${s.dir}/README.md`, quickstart: s.quickstart ?? `${s.dir}/QUICKSTART.md`,
    language: s.language, sdk: s.sdk, runtime: s.runtime, frameworks: s.frameworks,
    ...(s.apps && { apps: s.apps }),
    versionReadmes: s.versionReadmes,
    useCases,
    missing: USE_CASES.map((u) => u.id).filter((id) => !useCases[id]),
  };
});

// Keep the "Versions" line in every stack README in step with the table above.
const VERSIONS_LINE = /^\*\*Versions:\*\*.*$/m;
for (const s of stacks) {
  const sdk = s.sdk.startsWith("none") ? "no SDK, Req 0.5" : `SDK \`${s.sdk}\``;
  const line = `**Versions:** Elastic Email REST API v4 · ${sdk} · ${s.runtime} · ${s.frameworks.join(", ")}`;
  for (const readme of s.versionReadmes ?? [s.readme]) {
    const text = readFileSync(readme, "utf8");
    const next = VERSIONS_LINE.test(text) ? text.replace(VERSIONS_LINE, line) : text.replace(/^## Prerequisites$/m, `${line}\n\n## Prerequisites`);
    if (next === text && !text.includes(line)) throw new Error(`${readme}: no "## Prerequisites" heading to put the versions line above`);
    writeFileSync(readme, next);
  }
  delete s.versionReadmes;
}

const manifest = {
  $comment: "Generated by scripts/build-agent-files.mjs - edit the script, not this file.",
  name: "Elastic Email Examples",
  repository: REPO,
  api: { name: "Elastic Email REST API", version: "v4", baseUrl: "https://api.elasticemail.com/v4", auth: "X-ElasticEmail-ApiKey header",
    reference: "https://elasticemail.com/developers/api-documentation/rest-api" },
  sdkVersion: SDK_VERSION,
  env: { required: ["ELASTICEMAIL_API_KEY", "EMAIL_FROM", "EMAIL_TO"], guide: "docs/environment-variables.md" },
  useCases: USE_CASES.map(({ id, title, doc }) => ({ id, title, doc })),
  stacks,
};
writeFileSync("examples.json", JSON.stringify(manifest, null, 2) + "\n");

// llms-full.txt: the guides, then one quickstart per stack.
const read = (f) => readFileSync(f, "utf8").trim();
const section = (f) => `\n\n---\n\n<!-- source: ${REPO}/blob/main/${f} -->\n\n${read(f)}`;
const guides = ["docs/README.md", ...tracked.filter((f) => /^docs\/.+\.md$/.test(f) && f !== "docs/README.md").sort()];
// Sections outside the use-case matrix: SMTP (docs), templates, AI agents, background jobs.
const SECTION_QUICKSTARTS = [
  "smtp-elasticemail-examples/QUICKSTART.md",
  "email-templates-elasticemail-examples/QUICKSTART.md",
  "ai-agents-elasticemail-examples/QUICKSTART.md",
  "queues-elasticemail-examples/QUICKSTART.md",
];
const quickstarts = [...new Set([...stacks.map((s) => s.quickstart), ...SECTION_QUICKSTARTS])];
const full = [
  "# Elastic Email Examples - full text for LLMs",
  "",
  "> Every language-neutral guide and every stack quickstart from the Elastic Email examples repository, in one file.",
  `> Repository: ${REPO}. Index: ${REPO}/blob/main/llms.txt. Use-case to file map: ${REPO}/blob/main/examples.json.`,
  "> Examples target the Elastic Email REST API v4 with the official SDKs at version " + SDK_VERSION + ".",
].join("\n") + [...guides, ...quickstarts].map(section).join("") + "\n";
writeFileSync("llms-full.txt", full);

console.log(`examples.json: ${stacks.length} stacks, ${USE_CASES.length} use cases`);
console.log(`llms-full.txt: ${guides.length} guides, ${quickstarts.length} quickstarts, ${Math.round(full.length / 1024)} KB`);
