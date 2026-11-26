import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { systemRuntimeCachePath } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeCachePath";
import { withRuntimeDirectoryLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/withRuntimeDirectoryLock";

/**
 * Verifies the runtime fallback refuses aliases before creating a run or lock.
 *
 * 1. Select a missing cache under existing private temp without creating it.
 * 2. Redirect each cache and lock component to a visible source directory.
 * 3. Require refusal, an unchanged target, and success with ordinary entries.
 *
 * @evidence contracts/testing.md#behavioral-verification Real system fallback selection and lock acquisition reject native filesystem aliases. The unoccupied selection creates nothing, and the normal path grants a real lease.
 * @evidence contracts/testing.md#independent-expectations A literal sentinel and unchanged source listing establish the target's preservation. Neither result is derived from cache metadata or a mocked filesystem.
 * @evidence contracts/testing.md#distinguishing-cases Existing aliases at the shared system child, project cache, sibling lock and retired child each contrast with missing or ordinary entries.
 * @evidence contracts/testing.md#execution-ownership A synchronous unit uses an owned temp root and native links, removes each link before its root and starts no compiler, watcher or installed product.
 */
export function test_system_runtime_cache_rejects_aliased_paths(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-private-fallback-"));
  const source = path.join(root, "src");
  const temporary = path.join(root, "system-temp");
  try {
    fs.mkdirSync(source);
    fs.mkdirSync(temporary);
    fs.writeFileSync(path.join(source, "keep.ts"), "export {};\n");
    const fallback = systemRuntimeCachePath(source, temporary);
    const shared = path.dirname(fallback);
    assert.equal(path.dirname(shared), temporary);
    assert.deepEqual(fs.readdirSync(temporary), []);
    for (const location of [
      shared,
      fallback,
      `${fallback}.lock`,
      path.join(`${fallback}.lock`, "retired"),
    ]) {
      fs.mkdirSync(path.dirname(location), { recursive: true });
      fs.symlinkSync(source, location, "junction");
      try {
        assert.throws(
          () => systemRuntimeCachePath(source, temporary),
          /unsafe system runtime cache directory/,
        );
        if (location.startsWith(`${fallback}.lock`))
          assert.throws(
            () => withRuntimeDirectoryLock(fallback, assert.fail),
            /unsafe dependency lock directory/,
          );
        assert.deepEqual(fs.readdirSync(source), ["keep.ts"]);
        assert.equal(
          fs.readFileSync(path.join(source, "keep.ts"), "utf8"),
          "export {};\n",
        );
      } finally {
        if (process.platform === "win32") fs.rmdirSync(location);
        else fs.unlinkSync(location);
      }
    }
    assert.equal(systemRuntimeCachePath(source, temporary), fallback);
    assert.equal(
      withRuntimeDirectoryLock(fallback, () => "joined"),
      "joined",
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
