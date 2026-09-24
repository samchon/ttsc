import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { filesystemClockReferences } from "../../../../../packages/unplugin/lib/core/transform/clock/filesystemClockReferences.mjs";
import { refreshFilesystemClockReference } from "../../../../../packages/unplugin/lib/core/transform/clock/refreshFilesystemClockReference.mjs";
import { refreshScratchClockReference } from "../../../../../packages/unplugin/lib/core/transform/clock/refreshScratchClockReference.mjs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/lib/core/transform/filesystem/TtscTransformFilesystemOperations.mjs";

/**
 * Verifies a proof that holds no generation mints its clock reference outside
 * the project and leaves no storage behind, and that a proof which cannot mint
 * one keeps no older reference either.
 *
 * A failed generation's replay, a record's proof at a build start, and the
 * observer's proof of a plugin source have no retained probe directory, so they
 * mint in scratch storage (`refreshScratchClockReference`). They run often and
 * outlive no generation, so the storage must be gone when the reference is
 * minted: the reference is the probe's stamp, not the probe. When no scratch
 * directory can be made, a reference kept from an earlier proof would still let
 * a signature stand for content, the very trust a rollback defeats, so the
 * references are cleared instead and the proof reads content.
 *
 * 1. Mint through a filesystem that records every path it states, and assert one
 *    reference exists, its probe lay outside the project, and the probe's
 *    directory is gone.
 * 2. Mint a reference on a filesystem that cannot resolve any path, then ask it
 *    for a scratch reference, and assert no reference is left.
 */
export function test_scratch_clock_reference_leaves_no_storage_behind(): void {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-scratch-clock-"),
  );
  const outside = (location: string) => {
    const relative = path.relative(root, location);
    return (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    );
  };

  // 1. Minted outside the project, and nothing left.
  const stated: string[] = [];
  const recording: TtscTransformFilesystemOperations = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    lstat: (location) => {
      stated.push(path.resolve(location));
      return DEFAULT_FILESYSTEM_OPERATIONS.lstat(location);
    },
  };
  refreshScratchClockReference(root, recording);
  assert.equal(filesystemClockReferences(recording).size, 1);
  assert.equal(stated.length, 1, "the probe is the one path stated");
  assert.ok(outside(stated[0]!), `the probe lay outside the project`);
  assert.equal(
    fs.existsSync(path.dirname(stated[0]!)),
    false,
    "the scratch directory is removed",
  );

  // 2. No scratch storage: no reference either.
  const unresolvable: TtscTransformFilesystemOperations = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    realpath: () => {
      throw new Error("no path resolves");
    },
  };
  const earlier = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-scratch-clock-earlier-"),
  );
  refreshFilesystemClockReference(earlier, unresolvable);
  assert.equal(filesystemClockReferences(unresolvable).size, 1);
  refreshScratchClockReference(root, unresolvable);
  assert.equal(
    filesystemClockReferences(unresolvable).size,
    0,
    "an earlier proof's reference is not kept",
  );
}
