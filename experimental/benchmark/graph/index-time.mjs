// How long each tool takes to build its index, per repository.
//
// The agent-cost benchmark measures what a question costs once a tool is ready.
// It never shows what readiness costs, and that is not a footnote: on VS Code,
// codegraph spends ten minutes building an index before the agent may ask its
// first question, while the graph the TypeScript compiler already has to build
// takes forty seconds. A developer waits for both.
//
// This is a wall-clock measurement, so it is only honest on a quiet host: run it
// with nothing else on the machine, and never beside the agent benchmark.
//
// Each tool is timed cold — its index directory is removed first — once per
// repository, and the result is folded into the website's graph.json beside the
// agent cells, with the host it ran on.
//
// Usage:
//   node experimental/benchmark/graph/index-time.mjs
//   node experimental/benchmark/graph/index-time.mjs --repos=vue,vscode --tools=ttsc-graph,codegraph
//   node experimental/benchmark/graph/index-time.mjs --out=graph-index.json --no-website
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GRAPH_CORPUS, repoDirOf, tsconfigOf } from "./corpus.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || "1"];
  }),
);

const TOOLS = ["ttsc-graph", "codegraph", "codebase-memory"];
const repos = (args.repos ?? GRAPH_CORPUS.join(",")).split(",");
const tools = (args.tools ?? TOOLS.join(",")).split(",");

/**
 * `serena` is absent on purpose: it has no build step to time. It starts a
 * language server and resolves symbols on demand, which is a different bargain —
 * nothing to wait for up front, and every question pays the resolution.
 */
const BUILDERS = {
  "ttsc-graph": (repo) => {
    // The MCP server runs exactly this on startup, so the agent's first question
    // waits on it. Point it at the same binary the server would use.
    const binary =
      process.env.TTSC_GRAPH_BINARY ??
      path.join(repoRoot, "packages", "ttsc", "ttscgraph.exe");
    return {
      command: binary,
      args: ["dump", "--tsconfig", tsconfigOf(repo)],
      cwd: repoDirOf(repo),
      clean: () => {},
    };
  },
  codegraph: (repo) => ({
    command: "npx",
    args: ["-y", "@codegraph/mcp", "init", repoDirOf(repo)],
    cwd: repoRoot,
    clean: () => rmrf(path.join(repoDirOf(repo), ".codegraph")),
  }),
  "codebase-memory": (repo) => ({
    command: "npx",
    args: ["-y", "codebase-memory-mcp", "index", repoDirOf(repo)],
    cwd: repoRoot,
    clean: () => rmrf(path.join(repoDirOf(repo), ".codebase-memory")),
  }),
};

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function hostBlock() {
  const cpus = os.cpus();
  return {
    os: `${os.type()} ${os.release()}`,
    cpu: cpus[0]?.model?.trim() ?? "unknown",
    cores: cpus.length,
    ramGB: Math.round(os.totalmem() / 1024 ** 3),
    node: process.version,
  };
}

/**
 * The size of the program each index is built from, so a build time can be read
 * against the work it had to do: forty seconds on VS Code and one second on a
 * small backend are the same tool, not two.
 *
 * Only the sources the compiler would see: TypeScript and TSX, minus declaration
 * files and the usual non-source trees.
 */
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  "lib",
  "coverage",
  ".codegraph",
  ".codebase-memory",
  ".serena",
]);

function scaleOf(repo) {
  let files = 0;
  let lines = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith(".d.ts"))
        continue;
      files++;
      const text = fs.readFileSync(path.join(dir, entry.name), "utf8");
      lines += text.length === 0 ? 0 : text.split("\n").length;
    }
  };
  walk(repoDirOf(repo));
  return { files, lines };
}

const scale = {};
const cells = [];
for (const repo of repos) {
  scale[repo] = scaleOf(repo);
  console.log(
    `${repo}: ${scale[repo].files.toLocaleString()} source files, ${scale[repo].lines.toLocaleString()} lines`,
  );
  for (const tool of tools) {
    const builder = BUILDERS[tool];
    if (!builder) throw new Error(`unknown --tools entry ${tool}`);
    const spec = builder(repo);
    spec.clean();
    const started = process.hrtime.bigint();
    const run = cp.spawnSync(spec.command, spec.args, {
      cwd: spec.cwd,
      encoding: "utf8",
      maxBuffer: 1 << 30,
      shell: process.platform === "win32",
    });
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const ok = run.status === 0;
    cells.push({
      repo,
      tool,
      ms: ok ? ms : null,
      ...(ok ? {} : { failed: true }),
    });
    console.log(
      `  ${tool}: ${ok ? fmt(ms) : `FAILED (${(run.stderr ?? "").split("\n")[0]})`}`,
    );
  }
}

function fmt(ms) {
  return ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`;
}

const report = { host: hostBlock(), scale, cells };
if (args.out) {
  fs.writeFileSync(path.resolve(repoRoot, args.out), `${JSON.stringify(report, null, 2)}\n`);
}

if (args.website !== "0" && !("no-website" in args)) {
  const websiteJson = path.join(repoRoot, "website", "public", "benchmark", "graph.json");
  const prior = JSON.parse(fs.readFileSync(websiteJson, "utf8"));
  prior.index = report;
  fs.writeFileSync(websiteJson, `${JSON.stringify(prior)}\n`);
  console.log(`\nWrote index block into ${path.relative(repoRoot, websiteJson)} (${cells.length} cells).`);
}
