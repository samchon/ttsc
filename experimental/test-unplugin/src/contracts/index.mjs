import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { warmLinkedPlugin, workspace } from "./common.mjs";
import { warmPredicateProbe } from "./predicates.mjs";

// This inventory is checked against the installed package. Adding a public host
// without a direct execution contract must fail the package rehearsal.
const hosts = {
  vite7: ["vite"],
  vite8: ["vite"],
  "react-router": ["vite"],
  rollup: ["rollup"],
  rolldown: ["rolldown"],
  esbuild: ["esbuild"],
  webpack: ["webpack"],
  rspack: ["rspack"],
  farm: ["farm"],
  "next-webpack": ["next"],
  "next-turbopack": ["next", "turbopack"],
  bun: ["bun", "bun-register"],
};
const require = createRequire(import.meta.url);
const manifest = JSON.parse(
  fs.readFileSync(require.resolve("@ttsc/unplugin/package.json"), "utf8"),
);
assert.deepEqual(
  [...new Set(Object.values(hosts).flat())].sort(),
  Object.keys(manifest.exports)
    .filter((key) => ![".", "./api", "./package.json"].includes(key))
    .map((key) => key.slice(2))
    .sort(),
);
const selected = process.argv.slice(2);
for (const host of selected) assert.ok(host in hosts, `Unknown host: ${host}`);
// The predicate matrix links a contributor into the utility host, whose first
// build can take minutes on a cold Go cache. Pay it here, outside any host's
// deadline, so every host reuses the cached build.
await warmPredicateProbe();
// The host matrix's linked plugin links a contributor into the utility host
// too, another build paid here once.
await warmLinkedPlugin();
// Every host runs to its own verdict, so one failing host does not hide the
// verdicts of the hosts after it.
const failures = [];
for (const host of selected.length ? selected : Object.keys(hosts)) {
  const start = Date.now();
  const verdict = await new Promise((resolve, reject) => {
    // A process boundary owns native host resources and proves clean shutdown.
    // All hosts reuse the same install, source identity and native build cache.
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./worker.mjs", import.meta.url)), host],
      {
        cwd: workspace,
        stdio: "inherit",
        env: process.env,
        timeout: 900_000,
        windowsHide: true,
      },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) =>
      code === 0 && !child.killed
        ? resolve()
        : reject(
            new Error(
              `${host} exited ${code ?? signal}${child.killed ? " after its deadline" : ""}`,
            ),
          ),
    );
  }).then(
    () => undefined,
    (error) => error,
  );
  if (verdict === undefined) {
    console.log(
      `  ${host}: dependency/lifecycle contract passed (${Date.now() - start} ms)`,
    );
  } else {
    console.log(`  ${host}: dependency/lifecycle contract FAILED`);
    failures.push(verdict);
  }
}
if (failures.length !== 0) {
  throw new AggregateError(
    failures,
    failures.map((failure) => failure.message).join("; "),
  );
}
