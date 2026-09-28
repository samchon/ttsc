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
 */
export const test_ttsc_clean_reclaims_a_dead_runtime_lock_owner = (): void => {
  const root = TestProject.createProject({
    "package.json": JSON.stringify({
      name: "dead-runtime-lock",
      private: true,
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
};
