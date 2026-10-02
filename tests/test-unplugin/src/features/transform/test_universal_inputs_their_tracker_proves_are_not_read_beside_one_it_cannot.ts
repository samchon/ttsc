import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/src/core/transform/filesystem/TtscTransformFilesystemOperations";
import { inputMetadataSignature } from "../../../../../packages/unplugin/src/core/transform/inputs/inputMetadataSignature";
import { pluginSourceState } from "../../../../../packages/unplugin/src/core/transform/inputs/pluginSourceState";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import type { TtscHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/TtscHostInputValidation";
import { matchesUniversalHostInputs } from "../../../../../packages/unplugin/src/core/transform/validation/matchesUniversalHostInputs";

/**
 * Verifies one unproven universal source does not force neighboring proven
 * files through filesystem operations, and a named change rechecks only itself.
 *
 * The supplied tracker qualifies inputs individually. Six counted native
 * operations record only package.json and plugin.cjs touches, so this case
 * observes metadata/path/existence work as well as byte reads.
 *
 * 1. Supply real metadata and source state with the source unproven; require
 *    successful validation and no operation on either covered file.
 * 2. Name package.json changed and require success with only that one touch.
 * 3. Clear the change and unproven set and require success with no file touches.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual matchesUniversalHostInputs three times over authored tracker/manifest inputs. Exact touch lists empty/package.json/empty distinguish per-input qualification from an all-or-nothing recheck; existence, lstat, readFile, realpath, stat and statBigInt are counted on the two file spellings.
 * @evidence contracts/testing.md#independent-expectations Qualified silence belongs to each covered input. Literal touch lists follow that supported policy, independent of validator loop structure or source-provider output. Actual inputMetadataSignature and pluginSourceState supply baseline setup only, not expected scan counts or independent digest encoding.
 * @evidence contracts/testing.md#distinguishing-cases Two proven files beside one unproven tree contrast with a named changed manifest and finally all-proven coverage. Actual metadata/state must be available; the changed file remains unchanged on disk so its direct metadata proof succeeds. This case measures only the two file spellings, not tree/toolchain work or event transport.
 * @evidence contracts/testing.md#execution-ownership This discoverable direct unit owns the original four literal fixture files, actual validation operations and native Go environment inputs. Authored tracker fields are supported comparator arguments, not native-watch certification. It builds no compiler/plugin artifact and starts no watcher, installed consumer or host; E2E donor and native broker connection remain preserved.
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
  const entry = (file: string) => {
    const signature = inputMetadataSignature(file);
    assert.ok(signature, "native entry metadata must be readable");
    return { path: file, readable: true, realpath: file, signature, strict: true as const };
  };
  const sourceState = pluginSourceState(source);
  assert.ok(sourceState, "native source and build environment must be readable");
  const validation: TtscHostInputValidation = {
    covered: new Set([manifest, descriptor, source]),
    entries: new Map([
      [manifest, entry(manifest)],
      [descriptor, entry(descriptor)],
    ]),
    missing: new Map(),
    trees: new Map([[source, sourceState]]),
  };

  // 1. The files the tracker vouches for are not read.
  assert.equal(matchesUniversalHostInputs(cached, validation), true);
  assert.deepEqual(touched, [], "the proven files are left alone");

  // 2. A file the tracker heard change is read, alone.
  tracker.changes.add(manifest);
  assert.equal(matchesUniversalHostInputs(cached, validation), true);
  assert.deepEqual(touched.splice(0), ["package.json"]);
  tracker.changes.clear();

  // 3. Everything proven: nothing at all.
  delete tracker.unproven;
  assert.equal(matchesUniversalHostInputs(cached, validation), true);
  assert.deepEqual(touched, []);
}
