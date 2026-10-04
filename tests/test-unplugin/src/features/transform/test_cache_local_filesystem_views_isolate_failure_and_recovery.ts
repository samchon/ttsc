import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "../../../../utils/src/TestProject";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { walkSnapshotComplete } from "../../../../../packages/unplugin/src/core/transform/validation/walkSnapshotComplete";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";

/**
 * Verifies cache-local observing failures never leak into a sibling view.
 *
 * Real snapshots expose the failure and recovery; no compiler request or
 * synthetic native envelope is needed to select the owning filesystem table.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual createTtscTransformCache/transformFilesystem/collectProjectInputSnapshot isolate two provider tables. One nested readdir EACCES yields incomplete directory authority while the sibling reads and independently hashes both files; recovering that provider yields a complete first snapshot without changing the sibling's observations.
 * @evidence contracts/testing.md#independent-expectations Native roots, literal directory-read-failed classification, true/false completeness and Node SHA-256 over authored main/hidden bytes are independent expectations. Provider traces must never enter the sibling root, detecting cross-cache observation or global mutation.
 * @evidence contracts/testing.md#distinguishing-cases Concurrently retained views contrast refused and healthy enumeration, omitted defaults preserve native reading, and a subsequent recovered first view contrasts with a still-healthy unchanged sibling. Both caches and all trace ledgers have distinct owners.
 * @evidence contracts/testing.md#execution-ownership This exported unit invokes source snapshot owners in process over two native temporary corpora and supported cache-local filesystem arguments. It starts no compiler, peer, process or host; actual bounded capture attempts and coordinator errors remain separate operations. Finally resets both caches.
 */
export function test_cache_local_filesystem_views_isolate_failure_and_recovery(): void {
  const roots = [0, 1].map(() => TestProject.tmpdir("ttsc-local-view-unit-"));
  const text = "export const main = 1;\n";
  const hidden = "export const hidden = 2;\n";
  for (const root of roots) TestProject.writeFiles(root, {
    "tsconfig.json": '{"include":["src"]}',
    "src/main.ts": text,
    "src/nested/hidden.ts": hidden,
  });
  let blocked = true;
  const reads = [0, 0];
  const traces = roots.map(() => [] as string[]);
  const failurePath = path.join(roots[0]!, "src", "nested");
  let faults = 0;
  const caches = roots.map((_root, index) => createTtscTransformCache({
    readFile: (file) => {
      reads[index]! += 1;
      traces[index]!.push(path.resolve(file));
      return fs.readFileSync(file);
    },
    readdir: (directory) => {
      traces[index]!.push(path.resolve(directory));
      if (index === 0 && blocked && path.resolve(directory) === path.resolve(failurePath)) {
        faults += 1;
        throw Object.assign(new Error("first view cannot enumerate"), { code: "EACCES" });
      }
      return fs.readdirSync(directory, { withFileTypes: true });
    },
  }));
  const observe = (index: number) => {
    const root = roots[index]!;
    const filesystem = transformFilesystem(caches[index]);
    return collectProjectInputSnapshot(root, createHostPathIdentityContext(filesystem), filesystem, undefined, {
      policy: readProjectMembershipPolicy(path.join(root, "tsconfig.json")),
    });
  };
  const digest = (source: string) => createHash("sha256").update(source).digest("hex");
  try {
    assert.notEqual(transformFilesystem(caches[0]), transformFilesystem(caches[1]));
    const failed = observe(0);
    const healthy = observe(1);
    assert.equal(walkSnapshotComplete(failed, undefined), false);
    assert.equal(failed.directoryComplete, false);
    assert.deepEqual(failed.walkFailures.map((failure) => ({ kind: failure.kind, path: failure.path })), [{ kind: "directory-read-failed", path: failurePath }]);
    assert.equal(walkSnapshotComplete(healthy, undefined), true);
    assert.equal(healthy.hashes["src/main.ts"], digest(text));
    assert.equal(healthy.hashes["src/nested/hidden.ts"], digest(hidden));
    assert.ok(reads[0]! > 0);
    assert.ok(reads[1]! > 0);
    assert.ok(faults > 0);
    for (const [index, locations] of traces.entries()) {
      for (const location of locations) {
        const relative = path.relative(roots[1 - index]!, location);
        assert.ok(relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative), "a cache must never observe its sibling project");
      }
    }
    blocked = false;
    const recovered = observe(0);
    assert.equal(walkSnapshotComplete(recovered, undefined), true);
    assert.deepEqual(recovered.walkFailures, []);
    assert.equal(recovered.hashes["src/main.ts"], digest(text));
    assert.equal(recovered.hashes["src/nested/hidden.ts"], digest(hidden));
    assert.deepEqual(observe(1).hashes, healthy.hashes);
  } finally {
    for (const cache of caches) resetTtscTransformCache(cache);
  }
}
