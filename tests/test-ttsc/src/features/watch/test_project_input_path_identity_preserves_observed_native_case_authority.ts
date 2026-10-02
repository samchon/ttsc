import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createProjectInputPathIdentityContext";

/**
 * Preserves the observed native authority when identifying missing suffixes.
 *
 * The original absent-child and existing-empty-root inputs remain native.
 * Expectations branch on the SUT's caseSensitive observation: only false folds
 * the suffix; true and unknown preserve its spelling. This tests consistency of
 * authority transfer, not independent correctness of the native classifier.
 * Unknown remains unavailable evidence, not an OS-default capability result.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual default native identity context for the original absent-child and empty-root shapes, records its tri-state authority, and checks tsconfig.json/TSCONFIG.json path spellings and key equality under that observed policy.
 * @evidence contracts/testing.md#independent-expectations Native fs.realpathSync supplies the existing physical prefix and authored literal suffixes supply expected paths. The false-only folding contract determines the conditional result. Branching on the SUT-reported mode is disclosed and cannot independently detect a mistaken native sensitivity classification; no expected key is copied from resolve output.
 * @evidence contracts/testing.md#distinguishing-cases An absent never-created child and an existing directory with zero entries preserve both original inputs. Observed false converges the two suffix keys while true or undefined keeps them distinct. Supplied false/true/unknown authority has a separate direct unit; no new fixture case or platform-default premise is introduced here.
 * @evidence contracts/testing.md#execution-ownership This named source unit uses actual native temporary roots and default read-only case discovery, which can invoke Windows fsutil. It starts no compiler or product host. Root cleanup and per-input failures are collected; observed unknown is explicitly unavailable native authority rather than native capability PASS or watcher/cache completeness. The E2E donor remains until separate selection and execution evidence exists.
 */
export function test_project_input_path_identity_preserves_observed_native_case_authority(): void {
  const roots: string[] = [];
  const failures: Error[] = [];
  try {
    const absentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-identity-default-"));
    roots.push(absentRoot);
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-identity-empty-"));
    roots.push(empty);
    const absent = path.join(absentRoot, "never-created");
    for (const [name, directory, owner] of [
      ["absent-child", absent, absentRoot],
      ["empty-root", empty, empty],
    ] as const) {
      try {
        if (name === "absent-child") assert.equal(fs.existsSync(directory), false);
        else assert.deepEqual(fs.readdirSync(directory), []);
        const physicalPrefix = fs.realpathSync.native(owner);
        const expectedDirectory = name === "absent-child"
          ? path.join(physicalPrefix, "never-created")
          : physicalPrefix;
        const context = createProjectInputPathIdentityContext();
        const mode = context.caseSensitive(directory);
        console.log("native case authority", JSON.stringify({
          input: name,
          authority: mode === undefined ? "unavailable" : mode,
        }));
        const lower = context.resolve(path.join(directory, "tsconfig.json"));
        const upper = context.resolve(path.join(directory, "TSCONFIG.json"));
        assert.equal(lower.path, path.join(expectedDirectory, "tsconfig.json"));
        assert.equal(upper.path, path.join(expectedDirectory,
          mode === false ? "tsconfig.json" : "TSCONFIG.json"));
        assert.equal(lower.key === upper.key, mode === false);
      } catch (cause) {
        failures.push(new Error(`${name} native authority transfer`, { cause }));
      }
    }
  } catch (cause) {
    failures.push(new Error("native identity fixture preparation", { cause }));
  } finally {
    for (const root of roots) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (cause) {
        failures.push(new Error("native identity root cleanup", { cause }));
      }
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "native case authority transfer");
}
