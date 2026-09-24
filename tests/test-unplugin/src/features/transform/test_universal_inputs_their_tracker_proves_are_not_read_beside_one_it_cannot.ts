import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/lib/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM.mjs";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/lib/core/transform/cache/TtscCachedProjectTransform.mjs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/lib/core/transform/filesystem/TtscTransformFilesystemOperations.mjs";
import { inputMetadataSignature } from "../../../../../packages/unplugin/lib/core/transform/inputs/inputMetadataSignature.mjs";
import { pluginSourceState } from "../../../../../packages/unplugin/lib/core/transform/inputs/pluginSourceState.mjs";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import type { TtscHostInputValidation } from "../../../../../packages/unplugin/lib/core/transform/validation/TtscHostInputValidation.mjs";
import { matchesUniversalHostInputs } from "../../../../../packages/unplugin/lib/core/transform/validation/matchesUniversalHostInputs.mjs";

/**
 * Verifies each universal input is proven on its own, so one input its tracker
 * cannot vouch for sends no other back to the disk.
 *
 * On macOS a plugin source outside the project root is watched by a stream no
 * probe can prove delivered (samchon/ttsc#1453), so its tracker never vouches
 * for it, and every delivery re-proved every universal input: the project's
 * `package.json`, its plugin descriptor, and its tsconfig, which the tracker
 * did vouch for, measured on the macOS lane as a read of each on every delivery
 * through a linked project. Only the plugin source needs its proof.
 *
 * 1. Give a generation two universal files and a plugin source, all covered by a
 *    tracker that vouches for the files and names the plugin source unproven,
 *    and assert the proof holds without touching either file.
 * 2. Name one file changed, and assert that file alone is read, and the proof
 *    still holds on its metadata.
 * 3. Prove the plugin source too, and assert nothing at all is touched.
 */
export async function test_universal_inputs_their_tracker_proves_are_not_read_beside_one_it_cannot(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-universal-per-input-"),
  );
  TestProject.writeFiles(root, {
    "package.json": JSON.stringify({ name: "fixture" }),
    "plugin.cjs": "module.exports = () => ({});\n",
    "plugin/go.mod": "module example.com/plugin\n\ngo 1.26\n",
    "plugin/main.go": "package main\n\nfunc main() {}\n",
  });
  const manifest = path.join(root, "package.json");
  const descriptor = path.join(root, "plugin.cjs");
  const source = path.join(root, "plugin");

  const touched: string[] = [];
  const count = <T extends (location: string) => unknown>(operation: T): T =>
    ((location: string) => {
      if (location === manifest || location === descriptor)
        touched.push(path.basename(location));
      return operation(location);
    }) as T;
  const filesystem: TtscTransformFilesystemOperations = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    exists: count(DEFAULT_FILESYSTEM_OPERATIONS.exists),
    lstat: count(DEFAULT_FILESYSTEM_OPERATIONS.lstat),
    readFile: count(DEFAULT_FILESYSTEM_OPERATIONS.readFile),
    realpath: count(DEFAULT_FILESYSTEM_OPERATIONS.realpath),
    stat: count(DEFAULT_FILESYSTEM_OPERATIONS.stat),
    statBigInt: count(DEFAULT_FILESYSTEM_OPERATIONS.statBigInt),
  };
  const result = { type: "success", typescript: {} };
  TRANSFORM_RESULT_FILESYSTEM.set(result as never, filesystem);
  const tracker: TtscProjectMutationTracker = {
    changes: new Set(),
    changesOmitted: false,
    close: () => undefined,
    contentAuthoritative: true,
    covered: new Set([manifest, descriptor, source]),
    failed: false,
    membershipChanged: false,
    unproven: new Set([source]),
  };
  const cached = {
    hostInputMutationTracker: tracker,
    result,
  } as unknown as TtscCachedProjectTransform;
  const entry = (file: string) => ({
    path: file,
    readable: true,
    realpath: file,
    signature: inputMetadataSignature(file),
    strict: true as const,
  });
  const validation: TtscHostInputValidation = {
    covered: new Set([manifest, descriptor, source]),
    entries: new Map([
      [manifest, entry(manifest)],
      [descriptor, entry(descriptor)],
    ]),
    missing: new Map(),
    trees: new Map([[source, pluginSourceState(source)!]]),
  };

  // 1. The files the tracker vouches for are not read.
  assert.equal(matchesUniversalHostInputs(cached, validation), true);
  assert.deepEqual(touched, [], "the proven files are left alone");

  // 2. A file the tracker heard change is read, alone.
  (tracker.changes as Set<string>).add(manifest);
  assert.equal(matchesUniversalHostInputs(cached, validation), true);
  assert.deepEqual(touched.splice(0), ["package.json"]);
  (tracker.changes as Set<string>).clear();

  // 3. Everything proven: nothing at all.
  delete tracker.unproven;
  assert.equal(matchesUniversalHostInputs(cached, validation), true);
  assert.deepEqual(touched, []);
}
