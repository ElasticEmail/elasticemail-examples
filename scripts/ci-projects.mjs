#!/usr/bin/env node
// Lists every example project that CI builds, with the Docker image and the check command for it.
// Projects are found from their manifests, so a new stack is picked up without editing the workflow.
// Exceptions and toolchain images live in .github/ci/projects.json.
//
//   node scripts/ci-projects.mjs                    print every project and its check
//   node scripts/ci-projects.mjs --json             the same as a JSON array
//   node scripts/ci-projects.mjs --changed <file>   only projects touched by the paths listed in <file>
//                                                   (one per line), or all of them if a shared file changed
//
// With GITHUB_OUTPUT set, --json also writes `matrix` and `count` outputs for the workflow.
// To run one check locally: docker run --rm -v "$PWD:/repo" -w /repo/<path> <image> bash -eo pipefail -c '<check>'
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { basename, dirname, posix } from "node:path";

const config = JSON.parse(readFileSync(".github/ci/projects.json", "utf8"));
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const tracked = new Set(files);
const read = (path) => readFileSync(path, "utf8");
const join = (dir, name) => (dir === "." ? name : posix.join(dir, name));
const under = (path, dir) => dir === "." || path === dir || path.startsWith(dir + "/");

// Syntax-check every file with the given extensions, skipping dependency folders.
const eachFile = (exts, cmd) =>
  `find . \\( -name node_modules -o -name vendor -o -name .yarn -o -name .venv \\) -prune -o -type f \\( ${exts
    .map((e) => `-name '*${e}'`)
    .join(" -o ")} \\) -print0 | xargs -0 -r ${cmd}`;

const image = (kind, version) => config.images[kind].replace("{version}", version ?? "");
const match = (text, re) => text.match(re)?.[1];

// Each detector maps a manifest file to { kind, image, install, check } for the folder it sits in.
const detectors = [
  {
    file: /^package\.json$/,
    detect(dir, path) {
      const pkg = JSON.parse(read(path));
      // Workspace members (Redwood's api/ and web/) are built by the workspace root.
      const parent = join(dirname(dir), "package.json");
      if (dir !== "." && tracked.has(parent) && JSON.parse(read(parent)).workspaces) return null;
      const node = match(pkg.engines?.node ?? "", /^\s*(\d+)(?:\.x)?\s*$/) ?? config.defaults.node;
      const script = ["typecheck", "check"].find((s) => pkg.scripts?.[s]);
      return {
        kind: "node",
        image: image("node", node),
        install: "npm install --no-audit --no-fund",
        // JavaScript variants have no type checker: syntax-check the plain .js files instead.
        check: script ? `npm run ${script}` : eachFile([".js", ".mjs", ".cjs"], "-n1 node --check"),
      };
    },
  },
  {
    file: /^deno\.jsonc?$/,
    detect(dir, path) {
      const deno = JSON.parse(read(path));
      const entries = files.filter((f) => dirname(f) === dir && f.endsWith(".ts")).map((f) => basename(f));
      return { kind: "deno", image: image("deno"), check: deno.tasks?.check ? "deno task check" : `deno check ${entries.join(" ")}` };
    },
  },
  {
    // Supabase Edge Functions: supabase/config.toml, one Deno entry point per function.
    file: /^config\.toml$/,
    detect(dir) {
      if (basename(dir) !== "supabase") return null;
      return { dir: dirname(dir), kind: "deno", image: image("deno"), check: "deno check supabase/functions/*/index.ts" };
    },
  },
  {
    file: /^requirements\.txt$/,
    detect: () => ({
      kind: "python",
      image: image("python"),
      install: "pip install --root-user-action=ignore -q -r requirements.txt",
      check: eachFile([".py"], "python -m py_compile"),
    }),
  },
  {
    file: /^Gemfile$/,
    detect: () => ({ kind: "ruby", image: image("ruby"), install: "bundle install --quiet", check: eachFile([".rb"], "-n1 ruby -c") }),
  },
  {
    file: /^go\.mod$/,
    detect: (dir, path) => ({ kind: "go", image: image("go", match(read(path), /^go (\d+\.\d+)/m)), check: "go vet ./..." }),
  },
  {
    file: /^pom\.xml$/,
    detect(dir, path) {
      const java = match(read(path), /<(?:java\.version|maven\.compiler\.release|maven\.compiler\.source|kotlin\.compiler\.jvmTarget)>(\d+)</);
      return { kind: "maven", image: image("maven", java ?? config.defaults.java), check: "mvn -q -B compile" };
    },
  },
  {
    file: /\.(csproj|sln)$/,
    detect: (dir, path) => ({
      kind: "dotnet",
      image: image("dotnet", match(read(path), /<TargetFramework>net(\d+\.\d+)</) ?? "8.0"),
      check: `dotnet build ${basename(path)} --nologo`,
    }),
  },
  {
    // --bins covers apps declared as [[bin]] (axum_app), --examples the standalone scripts.
    file: /^Cargo\.toml$/,
    detect: () => ({ kind: "rust", image: image("rust"), check: "cargo check --quiet --bins --examples" }),
  },
  {
    file: /^mix\.exs$/,
    detect: () => ({
      kind: "elixir",
      image: image("elixir"),
      install: "mix local.hex --force && mix local.rebar --force && mix deps.get",
      check: "mix compile",
    }),
  },
  {
    file: /^composer\.json$/,
    detect: () => ({
      kind: "php",
      image: image("php"),
      install: "composer install --no-interaction --no-progress --quiet",
      check: eachFile([".php"], "-n1 php -l"),
    }),
  },
];

const found = new Map();
for (const path of files) {
  const dir = dirname(path);
  for (const d of detectors) {
    if (!d.file.test(basename(path))) continue;
    const project = d.detect(dir, path);
    if (project && !found.has(project.dir ?? dir)) found.set(project.dir ?? dir, { path: project.dir ?? dir, ...project });
  }
}

// A .sln builds the projects below it.
for (const [dir, p] of found) {
  if (p.kind === "dotnet" && [...found.values()].some((o) => o !== p && o.check.includes(".sln") && under(dir, o.path))) found.delete(dir);
}

// Standalone scripts in an example folder without a manifest (smtp-elasticemail-examples/nodejs/send.mjs).
for (const path of files) {
  if (!/^[^/]+-elasticemail-examples\//.test(path) || !/\.(mjs|cjs|js)$/.test(path)) continue;
  const dir = dirname(path);
  if ([...found.keys()].some((d) => under(path, d))) continue;
  found.set(dir, { path: dir, kind: "node-script", image: image("node", config.defaults.node), check: eachFile([".js", ".mjs", ".cjs"], "-n1 node --check") });
}

let projects = [...found.values()]
  .map((p) => {
    const override = config.projects[p.path] ?? {};
    const install = override.install ?? p.install;
    const check = override.check ?? p.check;
    return {
      path: p.path,
      image: override.image ?? p.image,
      run: install ? `${install}\n${check}` : check,
      known_failure: override.knownFailure ?? "",
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

for (const key of Object.keys(config.projects)) {
  if (!found.has(key)) throw new Error(`.github/ci/projects.json: no project at ${key}`);
}

const args = process.argv.slice(2);
const changedFile = args.includes("--changed") ? args[args.indexOf("--changed") + 1] : null;
if (changedFile) {
  const changed = read(changedFile).split("\n").map((l) => l.trim()).filter(Boolean)
    .filter((f) => !config.ignore.some((suffix) => f.endsWith(suffix)));
  const shared = changed.filter((f) => config.shared.some((s) => (s.endsWith("/") ? f.startsWith(s) : f === s)));
  if (shared.length) {
    console.error(`Shared files changed (${shared.join(", ")}): checking every project.`);
  } else {
    // Each file belongs to the deepest project folder that contains it.
    const owners = new Set(changed.map((f) => projects.filter((p) => under(f, p.path)).sort((a, b) => b.path.length - a.path.length)[0]?.path));
    projects = projects.filter((p) => owners.has(p.path));
  }
}

if (args.includes("--json")) {
  const json = JSON.stringify(projects);
  console.log(JSON.stringify(projects, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${json}\ncount=${projects.length}\n`);
} else {
  for (const p of projects) {
    console.log(`${p.path}  [${p.image}]${p.known_failure ? `  KNOWN FAILURE: ${p.known_failure}` : ""}`);
    for (const line of p.run.split("\n")) console.log(`    ${line}`);
  }
  console.log(`${projects.length} projects`);
}
