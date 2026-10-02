import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SourceBuildCacheLayout } from "../../../../../packages/ttsc/src/plugin/internal/source/SourceBuildCacheLayout";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the cache-root owner refuses an aliased leaf before maintenance.
 *
 * 1. Author a workspace cache leaf linked to an outside sentinel directory.
 * 2. Require the actual root validator to refuse it without touching that target.
 * 3. Replace the link with an ordinary directory and require its physical root.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source cache-root validation rejects the junction/symlink leaf and accepts its ordinary-directory replacement.
 * @evidence contracts/testing.md#independent-expectations The independently authored leaf, outside sentinel bytes and physical replacement identity establish rejection, nonmutation and positive expectations.
 * @evidence contracts/testing.md#distinguishing-cases An aliased cache leaf is refused while an ordinary leaf is admitted; the same parent layout and outside sentinel remain throughout.
 * @evidence contracts/testing.md#execution-ownership This source unit owns actual cache-root admission and filesystem nonmutation with no metadata reader, compiler, build or observer. The original builder case remains until its separate entry/lock/GC decisions are transferred.
 */
export function test_source_cache_root_rejects_leaf_aliases_without_touching_their_targets() {
  const container = TestProject.tmpdir("ttsc-cache-root-alias-source-");
  const project = path.join(container, "linked-plugin-root");
  const parent = path.join(project, "node_modules", ".cache", "ttsc");
  const root = path.join(parent, "plugins");
  const outside = path.join(container, "outside-plugin-root");
  const sentinel = path.join(outside, "keep.txt");
  fs.mkdirSync(parent, { recursive: true });
  fs.mkdirSync(outside);
  fs.writeFileSync(sentinel, "keep\n", "utf8");
  const entries = fs.readdirSync(outside).sort();
  fs.symlinkSync(
    outside,
    root,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(
    () => SourceBuildCacheLayout.canonicalPluginCacheRoot(root),
    /unsafe plugin cache root/,
  );
  assert.equal(fs.readFileSync(sentinel, "utf8"), "keep\n");
  assert.deepEqual(fs.readdirSync(outside).sort(), entries);
  fs.rmSync(root, { recursive: false });
  fs.mkdirSync(root);
  assert.equal(
    SourceBuildCacheLayout.canonicalPluginCacheRoot(root),
    fs.realpathSync.native(root),
  );
  assert.equal(fs.readFileSync(sentinel, "utf8"), "keep\n");
  assert.deepEqual(fs.readdirSync(outside).sort(), entries);
}
