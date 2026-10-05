import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProjectInputPathIdentityContext as installedOperation } from "../../../../../../../packages/ttsc/lib/internal/pathIdentity/createProjectInputPathIdentityContext.js";

/**
 * Retains the historical OS-name assertion pending actual direct-unit survival.
 *
 * Its empty-existing and absent-directory inputs remain native, but the old
 * Windows/macOS-insensitive versus Linux-sensitive premise is not the current
 * native authority contract. Discovery can report undefined. The approved
 * disposition preserves both inputs in the exact direct counterpart below:
 * false alone folds a literal missing suffix, true/undefined preserve spelling
 * against an independently resolved native prefix. Branching on the observed
 * SUT mode tests transfer consistency, not independent classifier correctness.
 * Unknown remains unavailable authority, not OS-neutral capability success.
 *
 * The two original OS-name assertions below are deliberately retained until
 * actual counterpart selection/execution/coverage permits donor removal; this
 * historical donor is not certified as verifying the supported contract.
 *
 * @evidenceExclude contracts/testing.md#behavioral-verification The retained historical OS-name equality assertions use a premise rejected by the current native tri-state contract; they are not current supported behavior verification. Exact direct test_project_input_path_identity_preserves_observed_native_case_authority.ts preserves both native inputs under the approved false-only folding contract, authored but UNEXECUTED.
 * @evidenceExclude contracts/testing.md#independent-expectations OS name is not an independent native volume authority oracle. The exact direct counterpart uses authored tsconfig.json/TSCONFIG.json suffixes and native fs.realpath prefix, discloses its SUT-mode branch and does not independently certify classifier correctness or unknown capability.
 * @evidence contracts/testing.md#distinguishing-cases Original empty-existing and absent-child populations remain unchanged. The approved direct counterpart retains both; supplied true/false/undefined authority owner1af728901 is a separate modeled-policy contribution, not their native execution proof.
 * @evidence contracts/testing.md#execution-ownership Existing installation caller supplies its candidate identity operation, but this entry directly invokes the owning operation with native inputs and no compiler/product protocol. Installed import alone is not necessary E2E; current function body/selection is retained as a donor, not runtime certification.
 * @evidenceExclude contracts/e2e.md#necessary-boundary Native directory inputs belong to direct identity operation ownership. Exact tests/test-ttsc/src/features/watch/test_project_input_path_identity_preserves_observed_native_case_authority.ts, fdba721e7bb60cf37e460b211fe5c9993c5ed0a2/COMMENT5397919734, implements the approved disposition; no new product policy/API is required.
 * @evidence contracts/e2e.md#shared-execution Existing two directory shapes and fresh per-shape contexts remain until actual direct survivor coverage permits duplicate-call removal. No achieved family, avoided preparation or process/Program count is claimed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original native roots and fresh contexts remain unchanged without global fs/flag replacement. Historical raw roots lack cleanup in this donor; the exact direct counterpart owns per-root cleanup/failure aggregation, whose actual execution is still unverified.
 * @evidence contracts/e2e.md#preserved-coverage Both original directory inputs, tsconfig.json/TSCONFIG.json operations and old OS-name assertions remain pending actual survivor execution/removal. Wrong premise disposition is recorded rather than silently deleting meaningful native inputs; exact counterpart source/body exists, actual selection/runtime/survival does not.
 */
export function case_project_input_path_identity_defaults_to_platform_case_semantics(
  createProjectInputPathIdentityContext: typeof installedOperation = installedOperation,
) {
  const insensitive =
    process.platform === "win32" || process.platform === "darwin";

  const absent = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-identity-default-")),
    "never-created",
  );
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-identity-empty-"));

  for (const directory of [absent, empty]) {
    const context = createProjectInputPathIdentityContext();
    const lower = context.resolve(path.join(directory, "tsconfig.json"));
    const upper = context.resolve(path.join(directory, "TSCONFIG.json"));
    const converged = lower.key === upper.key;
    assert.equal(
      converged,
      insensitive,
      `${directory} answered ${converged ? "insensitive" : "sensitive"} where ${process.platform} is ${insensitive ? "insensitive" : "sensitive"}`,
    );
  }
}
