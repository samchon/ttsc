import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isolatedCacheEnvironment } from "../../internal/isolated-cache-environment";
import { runtimeRunsDirectory } from "../../internal/ttsx-run";

/**
 * Verifies clean recovers a runtime transaction whose holder died.
 *
 * A force-terminated process can leave the fenced lock generation behind. The
 * next clean must retire that generation by its recorded owner and enter the
 * transaction, without deleting a successor's lock.
 *
 * 1. Acquire the runtime lock in a child that exits without releasing it.
 * 2. Run the real `ttsc clean` command against the same cache root.
 * 3. Assert clean recovers and removes the abandoned runtime directory.
 *
 * @evidence contracts/testing.md#behavioral-verification A seed worker acquires a real runtime lock then exits without release; the real ttsc clean command must succeed and remove the abandoned runtime directory.
 * @evidence contracts/testing.md#independent-expectations Actual seed process termination establishes a dead owner; runtime absence and zero clean status are literal public cleanup expectations independent of lock inspection.
 * @evidence contracts/testing.md#distinguishing-cases An abandoned acquired generation must not permanently block clean; live-holder exclusion is checked by the two-worker serialization case. No successor-generation assertion executes here.
 * @evidence contracts/testing.md#execution-ownership The named E2E entry owns the seed process and public CLI consumer; the generated acquire script is fixture input.
 * @evidence contracts/e2e.md#necessary-boundary The real clean command must assemble native liveness, lock reclamation and runtime deletion through its public path, rather than merely returning a direct reclaim result.
 * @evidence contracts/e2e.md#shared-execution One seed lifetime leaves the lock and one CLI lifetime consumes it; both reuse the fixture/cache, and neither compiles TypeScript or a plugin.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture declares its own workspace boundary so an ancestor installation cannot select an external cache. The isolated cache environment bounds default and legacy cleanup to the fixture; the seed exits before clean, and TestProject owns the remaining fixture tree on failure.
 * @evidence contracts/e2e.md#preserved-coverage Seed success, clean success and runtime removal remain here; successor fencing remains owned by the dedicated lock tests and is not proved by this case.
 */
export function test_ttsc_clean_reclaims_a_dead_runtime_lock_owner(): void {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({
      name: "dead-runtime-lock",
      private: true,
        workspaces: ["packages/*"],
    }),
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
    "src/main.ts": "export const value = 1;\n",
  });
  const runtime = path.dirname(runtimeRunsDirectory(root));
  fs.mkdirSync(runtime, { recursive: true });
  const lockDir = `${fs.realpathSync.native(runtime)}.lock`;
  const worker = path.join(root, "acquire-lock.cjs");
  const acquire = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "lib",
    "launcher",
    "internal",
    "runtime",
    "acquireDependencyBuildLock.js",
  );
  fs.writeFileSync(
    worker,
    [
      `const { acquireDependencyBuildLock } = require(${JSON.stringify(acquire)});`,
      `if (acquireDependencyBuildLock(${JSON.stringify(lockDir)}) === null) {`,
      '  throw new Error("the lock was not acquired");',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  const held = TestProject.spawn(process.execPath, [worker], { cwd: root });
  assert.equal(held.status, 0, held.stderr);

  const clean = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["clean", "--cwd", root],
    { cwd: root, env: isolatedCacheEnvironment(root) },
  );
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(fs.existsSync(runtime), false, clean.stdout);
}
