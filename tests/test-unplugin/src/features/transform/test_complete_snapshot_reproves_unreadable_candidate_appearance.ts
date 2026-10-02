import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { selectExternalInputPaths } from "../../../../../packages/unplugin/src/core/transform/envelope/selectExternalInputPaths";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { captureExternalInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/captureExternalInputSnapshot";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { matchesCompleteInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/matchesCompleteInputSnapshot";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies complete snapshot fallback re-proves a formerly absent universal
 * candidate even when its newly present bytes cannot be read.
 *
 * The external selector and both capture owners observe the actual initial
 * absent state. No input is removed from the external population to manufacture
 * a fallback gap; permission failure is supplied only after native creation.
 *
 * 1. Capture a literal successful generation's project, external and host inputs.
 * 2. Keep the candidate absent, then create readable and unreadable files.
 * 3. Reject both appearances, contrast directory appearance, and require actual
 *    removal to restore the original absence proof.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual selectExternalInputPaths, captureExternalInputSnapshot and captureUniversalHostInputValidation establish the generation before matchesCompleteInputSnapshot consumes it. Full fallback must reject an absent host candidate that becomes present even if EACCES leaves its byte hash unavailable.
 * @evidence contracts/testing.md#independent-expectations Real native creation/stat/realpath establish presence independently of the validator; only reading that exact file throws authored EACCES. Literal false distinguishes existence from unavailable bytes, while unchanged absence and recovered absence require true. Capture records setup facts and does not compute the expected verdict.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged absent, readable file appearance, unreadable file appearance, directory appearance and removal recovery exercise distinct state transitions. The candidate remains in the actual external selection and universal manifest; it lies below excluded node_modules so project source membership cannot incidentally detect its creation.
 * @evidence contracts/testing.md#execution-ownership A single source entry directly runs owning selectors/capture/complete validation over real temporary files through the result's existing filesystem registration. The envelope is authored without compiler output planting or tracker authority mutation; no native compiler, watcher, process or consumer installation runs.
 */
export function test_complete_snapshot_reproves_unreadable_candidate_appearance(): void {
  const root = fs.realpathSync.native(TestProject.createProject({
    "src/main.ts": "export const value = 1;\n",
    "tsconfig.json": '{"include":["src"]}',
    "node_modules/plugin/kept.txt": "parent exists\n",
  }));
  const candidate = path.join(root, "node_modules", "plugin", "candidate.json");
  const file = path.join(root, "src", "main.ts");
  let denyRead = false;
  const filesystem = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    caseSensitive: () => true,
    readFile: (location: string) => {
      if (location === candidate && denyRead) {
        throw Object.assign(new Error("authored unreadable native file"), { code: "EACCES" });
      }
      return DEFAULT_FILESYSTEM_OPERATIONS.readFile(location);
    },
  };
  const result: ITtscCompilerTransformation.ISuccess = {
    type: "success",
    typescript: { "src/main.ts": "export const value = 1;\n" },
    hostInputs: [candidate],
    hostInputHashes: { [candidate]: null },
  };
  TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
  const cached: TtscCachedProjectTransform = {
    projectRoot: root,
    tsconfig: path.join(root, "tsconfig.json"),
    membershipPolicy: readProjectMembershipPolicy(path.join(root, "tsconfig.json")),
    result,
    inputHashes: {},
  };
  try {
    const state = envelopeDerivation(cached);
    const project = collectProjectInputSnapshot(root, state.identityContext, filesystem, undefined, { policy: cached.membershipPolicy });
    assert.equal(project.complete, true);
    cached.inputHashes = project.hashes;
    cached.projectDirectories = project.projectDirectories;
    cached.projectSnapshotComplete = true;
    const selected = selectExternalInputPaths({ filesystem, membershipPolicy: cached.membershipPolicy, projectRoot: root, result });
    assert.deepEqual(selected, [candidate], "actual selector retains missing universal input");
    const external = captureExternalInputSnapshot(cached, selected, undefined);
    assert.equal(external.complete, true);
    cached.externalInputPaths = selected;
    cached.externalInputHashes = external.hashes;
    cached.externalInputObservations = external.observations;
    cached.externalInputRealpaths = external.realpaths;
    cached.externalInputSignatures = external.signatures;
    const universal = captureUniversalHostInputValidation(cached, file);
    assert.deepEqual(universal.failures.entries, []);
    assert.ok(universal.validation);
    assert.equal(universal.validation.entries.has(candidate), false);
    assert.equal(universal.validation.covered.has(candidate), true);
    assert.equal(matchesCompleteInputSnapshot(cached), true, "unchanged absence");
    fs.writeFileSync(candidate, "{}\n");
    assert.equal(matchesCompleteInputSnapshot(cached), false, "readable file appeared");
    denyRead = true;
    assert.equal(fs.statSync(candidate).isFile(), true);
    assert.equal(fs.realpathSync.native(candidate), candidate);
    assert.equal(matchesCompleteInputSnapshot(cached), false, "unreadable present file cannot remain absent");
    denyRead = false;
    fs.rmSync(candidate);
    fs.mkdirSync(candidate);
    assert.equal(matchesCompleteInputSnapshot(cached), false, "directory appeared");
    fs.rmdirSync(candidate);
    assert.equal(matchesCompleteInputSnapshot(cached), true, "actual absence recovered");
  } finally {
    TRANSFORM_RESULT_FILESYSTEM.delete(result);
  }
}
