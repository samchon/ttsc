import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// The full build remains the release and cross-platform verification boundary.
// E2E installs only its host graph package, so it can exclude the other graph
// targets without changing any test or the remaining package build population.
const root = fileURLToPath(new URL("../", import.meta.url));
const options = process.argv.slice(2);
if (options.some((option) => option !== "--host-graph"))
  throw new Error("Unknown build option: " + options.join(" "));

const filters = ["./packages/*", "lint-contributor-demo"];
if (options.includes("--host-graph")) {
  const graph = JSON.parse(
    fs.readFileSync(new URL("../packages/graph/package.json", import.meta.url), "utf8"),
  );
  const nativePackages = Object.keys(graph.optionalDependencies).filter((name) =>
    name.startsWith("@ttsc/graph-"),
  );
  const host = `@ttsc/graph-${process.platform}-${process.arch}`;
  if (!nativePackages.includes(host))
    throw new Error("No graph platform package for this build host: " + host);
  for (const name of nativePackages)
    if (name !== host) filters.push("!" + name);
}

const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run the build through pnpm run build");
const result = spawnSync(
  process.execPath,
  [pnpm, ...filters.flatMap((filter) => ["--filter", filter]), "-r", "--workspace-concurrency=1", "build"],
  { cwd: root, stdio: "inherit", windowsHide: true },
);
if (result.error) throw result.error;
if (result.signal) throw new Error("Build terminated by signal " + result.signal);
process.exitCode = result.status ?? 1;
