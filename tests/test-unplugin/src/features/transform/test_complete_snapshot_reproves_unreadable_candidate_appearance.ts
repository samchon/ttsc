import assert from "node:assert/strict";
import crypto from "node:crypto";
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
 * 4. Capture fresh readable candidate bytes, then withhold only lexical lstat
 *    metadata through EIO/EACCES. Admission may decline this uncertainty or
 *    keep a readable entry without a signature, but cannot call it absent.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual selectExternalInputPaths, captureExternalInputSnapshot and captureUniversalHostInputValidation establish the generation before matchesCompleteInputSnapshot consumes it. Full fallback must reject an absent host candidate that becomes present even if EACCES leaves its byte hash unavailable. Fresh readable candidate capture additionally forbids grouped/exact absence after only lexical metadata becomes unavailable.
 * @evidence contracts/testing.md#independent-expectations Real native creation/stat/realpath establish presence independently of the validator; only reading that exact file throws authored EACCES. Literal false distinguishes existence from unavailable bytes, while unchanged absence and recovered absence require true. Capture records setup facts and does not compute the expected verdict. Node SHA-256 independently supplies the readable host-byte witness; healthy admission must retain a present entry, while EIO/EACCES may conservatively decline or retain only a readable entry without metadata reuse.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged absent, readable file appearance, unreadable file appearance, directory appearance and removal recovery exercise distinct state transitions. The candidate remains in the actual external selection and universal manifest; it lies below excluded node_modules so project source membership cannot incidentally detect its creation. Fresh healthy/EIO/EACCES captures keep actual external selection and recorded bytes, distinguishing metadata observation failure from native absence.
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
  let metadataError: "EIO" | "EACCES" | undefined;
  const filesystem = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    caseSensitive: () => true,
    lstat: (location: string) => {
      if (location === candidate && metadataError !== undefined) {
        throw Object.assign(new Error("authored unavailable lexical metadata"), {
          code: metadataError,
        });
      }
      return DEFAULT_FILESYSTEM_OPERATIONS.lstat(location);
    },
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

    // Existing readable bytes with unavailable lexical metadata are not absence.
    fs.writeFileSync(candidate, '{"present":true}\n');
    const nativeHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(candidate))
      .digest("hex");
    assert.equal(fs.statSync(candidate).isFile(), true);
    assert.equal(fs.realpathSync.native(candidate), candidate);
    for (const error of [undefined, "EIO", "EACCES"] as const) {
      metadataError = error;
      const presentResult: ITtscCompilerTransformation.ISuccess = {
        type: "success",
        typescript: { "src/main.ts": "export const value = 1;\n" },
        hostInputs: [candidate],
        hostInputHashes: { [candidate]: nativeHash },
        hostInputRealpaths: { [candidate]: candidate },
      };
      TRANSFORM_RESULT_FILESYSTEM.set(presentResult, filesystem);
      try {
        const present: TtscCachedProjectTransform = {
          projectRoot: root,
          tsconfig: cached.tsconfig,
          membershipPolicy: cached.membershipPolicy,
          result: presentResult,
          inputHashes: {},
        };
        const presentState = envelopeDerivation(present);
        const observed = collectProjectInputSnapshot(
          root,
          presentState.identityContext,
          filesystem,
          undefined,
          { policy: present.membershipPolicy },
        );
        assert.equal(observed.complete, true);
        present.inputHashes = observed.hashes;
        present.projectDirectories = observed.projectDirectories;
        present.projectSnapshotComplete = observed.complete;
        const inputs = selectExternalInputPaths({
          filesystem,
          membershipPolicy: present.membershipPolicy,
          projectRoot: root,
          result: presentResult,
        });
        assert.deepEqual(inputs, [candidate]);
        const recorded = captureExternalInputSnapshot(present, inputs, undefined);
        assert.equal(recorded.complete, true, "actual external capture reaches this boundary");
        assert.deepEqual(Object.values(recorded.hashes), [nativeHash]);
        present.externalInputPaths = inputs;
        present.externalInputHashes = recorded.hashes;
        present.externalInputObservations = recorded.observations;
        present.externalInputRealpaths = recorded.realpaths;
        present.externalInputSignatures = recorded.signatures;
        const admission = captureUniversalHostInputValidation(present, file);
        assert.equal(
          admission.validation?.missing
            .get(path.dirname(candidate))
            ?.has("candidate.json") ?? false,
          false,
          "metadata uncertainty cannot become a grouped absence proof",
        );
        assert.equal(
          admission.validation?.directMissing?.has(candidate) ?? false,
          false,
          "metadata uncertainty cannot become an exact absence proof",
        );
        if (error === undefined || admission.validation !== undefined) {
          assert.ok(admission.validation);
          assert.deepEqual(admission.failures.entries, []);
          assert.equal(admission.validation.entries.has(candidate), true);
          assert.equal(admission.validation.entries.get(candidate)?.readable, true);
          if (error !== undefined) {
            assert.equal(admission.validation.entries.get(candidate)?.signature, undefined);
          }
        } else {
          assert.equal(
            admission.failures.entries.some((failure) =>
              failure.domain === "host" && failure.path === candidate,
            ),
            true,
            "declined manifest reports the unavailable candidate proof",
          );
        }
      } finally {
        TRANSFORM_RESULT_FILESYSTEM.delete(presentResult);
      }
    }
  } finally {
    TRANSFORM_RESULT_FILESYSTEM.delete(result);
  }
}
