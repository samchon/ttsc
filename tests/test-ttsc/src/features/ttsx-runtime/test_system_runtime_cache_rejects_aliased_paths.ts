import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { dependencyCacheRoot } from "../../../../../packages/ttsc/src/launcher/internal/runtime/dependencyCacheRoot";
import {
  pinSystemRuntimeCachePath,
  systemRuntimeCachePath,
} from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeCachePath";
import { withRuntimeDirectoryLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/withRuntimeDirectoryLock";

/**
 * Verifies the runtime fallback refuses aliases before creating a run or lock.
 *
 * 1. Select a missing cache under existing private temp without creating it.
 * 2. Redirect each cache and lock component to a visible source directory.
 * 3. Refuse project-owned and read-only cache children, then claim ordinary
 *    storage.
 *
 * @evidence contracts/testing.md#behavioral-verification Real fallback pinning rejects native aliases, including the run index. Each cache refuses deterministic children owned by a selected or marked project. A non-root POSIX run observes actual denial at preexisting storage. Disjoint cache children admit a real lock or process owner.
 * @evidence contracts/testing.md#independent-expectations A literal sentinel and unchanged source listing establish the target's preservation. Neither result is derived from cache metadata or a mocked filesystem.
 * @evidence contracts/testing.md#distinguishing-cases Shared, cache, index, lock and retired aliases are distinct refusal points. Selected and independently marked projects contrast with unmarked directories. Only a non-root POSIX run exercises file-mode refusal with ordinary entries.
 * @evidence contracts/testing.md#execution-ownership A synchronous unit uses an owned temp root and native links, removes each link before its root and starts no compiler, watcher or installed product.
 */
export function test_system_runtime_cache_rejects_aliased_paths(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-private-fallback-")),
  );
  const source = path.join(root, "src");
  const temporary = path.join(root, "system-temp");
  const alternate = path.join(root, "alternate-temp");
  try {
    fs.mkdirSync(source);
    fs.mkdirSync(temporary);
    fs.mkdirSync(alternate);
    fs.writeFileSync(path.join(source, "keep.ts"), "export {};\n");
    const fallback = systemRuntimeCachePath(source, temporary);
    const shared = path.dirname(fallback);
    assert.equal(path.dirname(shared), temporary);
    assert.deepEqual(fs.readdirSync(temporary), []);
    for (const location of [
      shared,
      fallback,
      path.join(fallback, "project"),
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
        assert.equal(
          pinSystemRuntimeCachePath(source, temporary, [source]),
          undefined,
        );
        if (location === fallback)
          assert.equal(
            pinSystemRuntimeCachePath(source, temporary, [source]) ??
              pinSystemRuntimeCachePath(source, alternate, [source]),
            systemRuntimeCachePath(source, alternate),
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
    const selected = path.join(fallback, "selected");
    fs.mkdirSync(selected);
    fs.writeFileSync(path.join(selected, "custom.json"), '{"files":[]}');
    assert.equal(
      pinSystemRuntimeCachePath(source, temporary, [source, selected]),
      undefined,
    );
    assert.deepEqual(fs.readdirSync(selected), ["custom.json"]);
    const workspace = path.join(shared, "package.json");
    fs.writeFileSync(workspace, '{"name":"unrelated"}');
    assert.equal(
      pinSystemRuntimeCachePath(source, temporary, [source]),
      undefined,
    );
    fs.unlinkSync(workspace);
    fs.rmdirSync(`${fallback}.lock`);
    const exercisesPermission =
      process.platform !== "win32" && process.getuid?.() !== 0;
    const permissionDenied = (error: unknown): boolean =>
      ["EACCES", "EPERM", "EROFS"].includes(
        (error as NodeJS.ErrnoException | null)?.code ?? "",
      );
    if (exercisesPermission) {
      fs.chmodSync(shared, 0o500);
      try {
        assert.throws(
          () => pinSystemRuntimeCachePath(source, temporary, [source]),
          permissionDenied,
        );
        assert.deepEqual(fs.readdirSync(shared), [path.basename(fallback)]);
      } finally {
        fs.chmodSync(shared, 0o700);
      }
    }
    assert.equal(
      pinSystemRuntimeCachePath(source, temporary, [source]),
      fallback,
    );
    assert.equal(
      withRuntimeDirectoryLock(fallback, () => "joined"),
      "joined",
    );
    const dependencyParent = path.join(temporary, "ttsx-dep");
    fs.mkdirSync(dependencyParent);
    assert.equal(
      dependencyCacheRoot.claimUnderTemporary(temporary, [dependencyParent]),
      undefined,
    );
    const manifest = path.join(dependencyParent, "go.mod");
    fs.writeFileSync(manifest, "module example.test/unrelated\n");
    assert.equal(
      dependencyCacheRoot.claimUnderTemporary(temporary, [source]),
      undefined,
    );
    fs.unlinkSync(manifest);
    fs.rmdirSync(dependencyParent);
    fs.symlinkSync(source, dependencyParent, "junction");
    try {
      const alternateProcess =
        dependencyCacheRoot.claimUnderTemporary(temporary, [source]) ??
        dependencyCacheRoot.claimUnderTemporary(alternate, [source]);
      assert.ok(alternateProcess);
      assert.equal(
        path.dirname(alternateProcess),
        path.join(alternate, "ttsx-dep"),
      );
      assert.deepEqual(fs.readdirSync(source), ["keep.ts"]);
    } finally {
      if (process.platform === "win32") fs.rmdirSync(dependencyParent);
      else fs.unlinkSync(dependencyParent);
    }
    fs.mkdirSync(dependencyParent);
    if (exercisesPermission) {
      fs.chmodSync(dependencyParent, 0o500);
      try {
        assert.throws(
          () => dependencyCacheRoot.claimUnderTemporary(temporary, [source]),
          permissionDenied,
        );
        assert.deepEqual(fs.readdirSync(dependencyParent), []);
      } finally {
        fs.chmodSync(dependencyParent, 0o700);
      }
    }
    const processDirectory = dependencyCacheRoot.claimUnderTemporary(
      temporary,
      [source],
    );
    assert.ok(processDirectory);
    assert.equal(path.dirname(processDirectory), dependencyParent);
    assert.deepEqual(fs.readdirSync(processDirectory), [
      `owner-${process.pid}.json`,
    ]);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
