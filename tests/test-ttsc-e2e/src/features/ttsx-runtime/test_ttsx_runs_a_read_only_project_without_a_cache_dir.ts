import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { denyWrites, runsAsRoot } from "../../internal/read-only-directory";

/**
 * Verifies ttsx runs an included entry of a project whose directory refuses
 * writes, without being told where to cache.
 *
 * With no `--cache-dir`, the runtime output goes below the project's own
 * `node_modules/.cache/ttsc/ttsx`. A read-only checkout, mount, or container
 * filesystem refuses that directory, and the run ended on a bare `EPERM` before
 * anything compiled. Each run writes into a directory of its own and removes it
 * on exit, so any writable parent serves: the default falls back to one below
 * the system temp directory, and the project is left exactly as it was.
 *
 * Root ignores directory permissions, so the case cannot hold there.
 *
 * 1. Create a project with an included entry.
 * 2. Deny writes to the project directory and run the entry without `--cache-dir`.
 * 3. Assert the entry ran and the project directory gained nothing.
 * @evidence contracts/testing.md#behavioral-verification Denies project writes, runs without explicit cache-dir, requires read-only-ran and compares top-level project names after restoring permissions.
 * @evidence contracts/testing.md#independent-expectations The authored marker and pre-run directory names independently establish execution and the observed no-new-top-level-entry property.
 * @evidence contracts/testing.md#distinguishing-cases Root execution returns without checking permission refusal; descendants, bytes, fallback cache location and cache cleanup are not asserted.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_runs_a_read_only_project_without_a_cache_dir at this path, selected by tests/test-scripts-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Real OS permission enforcement, native compilation and Node execution connect fallback output placement to a read-only project.
 * @evidence contracts/e2e.md#shared-execution One host and one project exercise permission refusal using shared compiler preparation; no repeated plugin producer is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Permission restoration is in finally; the Windows ACL removal result is unchecked and tracked directory cleanup is deferred to process exit.
 * @evidence contracts/e2e.md#preserved-coverage Runtime success and top-level name equality remain here, while root bypass and incomplete permission/cache observations are explicitly limited.
 */
export function test_ttsx_runs_a_read_only_project_without_a_cache_dir() {
  if (runsAsRoot()) return;
  const root = TestProject.createProject({
    "package.json": JSON.stringify({ name: "readonlycache", private: true }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        types: [],
      },
      include: ["src"],
    }),
    "src/main.ts": `console.log("read-only-ran");\nexport {};\n`,
  });
  const before = fs.readdirSync(root).sort();
  const restore = denyWrites(root);
  try {
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "read-only-ran");
  } finally {
    restore();
  }
  assert.deepEqual(fs.readdirSync(root).sort(), before);
}
