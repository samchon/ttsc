import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BROKEN_INPUT } from "../common.mjs";

/**
 * Verifies a Bun preload rejects invalid input and reads edits across fresh runtime sessions.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   Actual Bun.spawnSync executes bun run with bun-register preload. Broken input must exit nonzero with the compiler diagnostic; two repaired states must print four copies of RUNTIME_FIRST then RUNTIME_SECOND.
 * @evidence contracts/testing.md#independent-expectations
 *   The authored broken type is invalid and the two literal input values define expected runtime stdout. Nonzero status alone is insufficient, so the original compiler diagnostic pattern is also required.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Includes invalid input and two successful changed states. Four modules must agree in each process, and the second successful process cannot reuse the previous immutable runtime generation.
 * @evidence contracts/testing.md#execution-ownership
 *   Bun worker calls this named entry after its build scenario batch, passing that batch project. This is actual Bun E2E; source Bun callback units own filter and parser decisions without starting Bun.
 * @evidence contracts/e2e.md#necessary-boundary
 *   Installed bun-register must load as a real preload, reject compiler failure and deliver the current project generation to Bun runtime imports. Bundler setup tests and simulated onLoad calls cannot prove preload resolution.
 * @evidence contracts/e2e.md#shared-execution
 *   Shares one packed install, producer and project with the preceding Bun build batch. Three fresh runtimes are necessary because each preload process owns an immutable load session and the case compares invalid and two changed inputs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity
 *   Writes bunfig only after the Bun.build batch, then mutates input before each process. Synchronous child exit ends each runtime; no handle or in-memory generation is carried across states.
 * @evidence contracts/e2e.md#preserved-coverage
 *   All original broken status/diagnostic assertions and successful four-module stdout assertions remain in this extracted body. No new build or install is added and no preload failure is replaced with source-only coverage.
 */
export async function test_host_bun_preload_runtime(project) {
// The preload session owns a different cache lifetime: each `bun run` is one
// immutable load session.
fs.writeFileSync(
  path.join(project.root, "bunfig.toml"),
  'preload = ["@ttsc/unplugin/bun-register"]\n',
);
const run = (args) =>
  Bun.spawnSync(["bun", ...args], { cwd: project.root, env: process.env });
project.break();
const broken = run(["run", "src/main.ts"]);
assert.notEqual(broken.exitCode, 0);
assert.match(
  `${broken.stdout}${broken.stderr}`,
  BROKEN_INPUT,
  "a broken input fails a runtime session",
);
for (const value of ["RUNTIME_FIRST", "RUNTIME_SECOND"]) {
  project.change(value);
  const ran = run(["run", "src/main.ts"]);
  assert.equal(ran.exitCode, 0, `${ran.stderr}`);
  assert.equal(
    String(ran.stdout).trim(),
    [value, value, value, value].join(" "),
  );
}

}
