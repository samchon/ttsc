import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";

/**
 * Verifies failed or input-moving producers cannot leave an accepted document.
 *
 * 1. Execute a failed producer, then two producers that move their input state.
 * 2. Execute a successful stable producer and a separate unchanged request.
 * 3. Assert every unsafe request builds and only stable completion is reused.
 *
 * @evidence contracts/testing.md#behavioral-verification The production store receives real failed/moving callbacks and filesystem output; exact callback counts prove unsafe completion never becomes a hit.
 * @evidence contracts/testing.md#independent-expectations Authored status, state transitions and expected five producer calls define the oracle without consulting cache names or manifests.
 * @evidence contracts/testing.md#distinguishing-cases Failure, movement across a successful build, stable success and a later private-directory reuse distinguish result status from input stability and cache equivalence.
 * @evidence contracts/testing.md#execution-ownership The test-ttsc unit runner discovers the named export; supplied producers exercise store semantics without launching a native compiler or product host.
 */
export function test_runtimebuildcache_never_publishes_failed_or_moving_generations(): void {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsx-runtime-cache-failure-"),
  );
  try {
    let state = 0;
    let builds = 0;
    const request = (name: string, status: number, moving: boolean) => {
      const emitDir = path.join(root, name);
      fs.mkdirSync(emitDir);
      return RuntimeBuildCache.run({
        directory: path.join(root, "cache"),
        emitDir,
        capture: () => String(state),
        admit: () => true,
        build: () => {
          builds++;
          if (moving) state++;
          fs.writeFileSync(path.join(emitDir, "main.js"), "export {};");
          return {
            status,
            diagnostics: [],
            stdout: "",
            stderr: "",
            emittedSources: {
              [path.join(emitDir, "main.js")]: [path.join(root, "main.ts")],
            },
          };
        },
      });
    };
    assert.equal(request("failed-a", 1, false).status, 1);
    assert.equal(request("failed-b", 1, false).status, 1);
    request("moving-a", 0, true);
    request("moving-b", 0, true);
    request("stable", 0, false);
    request("reused", 0, false);
    assert.equal(builds, 5);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
