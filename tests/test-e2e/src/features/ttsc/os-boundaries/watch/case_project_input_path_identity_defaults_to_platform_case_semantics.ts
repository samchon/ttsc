import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProjectInputPathIdentityContext as installedOperation } from "../../../../../../../packages/ttsc/lib/internal/pathIdentity/createProjectInputPathIdentityContext.js";

/**
 * Verifies a directory with nothing to probe answers the way its platform does.
 *
 * Every case probe answers by proof: two names that fold together prove the
 * volume keeps them apart, and a name that opens under the other case proves it
 * does not. An empty directory, and one that does not exist yet, offer neither.
 * That is not a rare shape here — a watch host asks about the parent of a
 * config that was just deleted, and about roots the build is about to create.
 *
 * Answering case-sensitive there is the expensive mistake on Windows and macOS,
 * whose volumes are insensitive unless someone opted out: one file acquires two
 * identities under two spellings, so a record written under the first is
 * invisible to a lookup under the second, which is the whole failure this
 * module removes. On Linux the same answer is simply correct.
 *
 * This pins the answer to the platform rather than to the mechanism, because
 * which mechanism supplies it is not the contract — a host may reach it from
 * `fsutil`, from walking to a named ancestor, or from the fallback when neither
 * is available, and all three owe the same answer.
 *
 * 1. Take a directory with no entry to probe, existing and not.
 * 2. Resolve two spellings of one missing child that differ only in case.
 * 3. Assert they converge exactly where the platform converges.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual packed-SDK identity transactions compare two missing-child spellings under empty and absent directories and require convergence exactly on the existing platform-default contract.
 * @evidence contracts/testing.md#independent-expectations The supported Windows/macOS default-insensitive and Linux default-sensitive contract defines the literal expectation independently of the identity mechanism; this case retains that original default-volume premise.
 * @evidence contracts/testing.md#distinguishing-cases Empty existing and absent directory populations separately retain their original assertion; Windows sensitive overrides execute in the neighboring actual case and explicit authority distinctions execute in source units.
 * @evidence contracts/testing.md#execution-ownership This named os-boundaries/watch entry runs the supplied packed-SDK identity operation against the actual installation platform's volume within the sole OS matrix; it does not add unit OS execution.
 * @evidence contracts/e2e.md#necessary-boundary Empty/absent native directory authority and missing-suffix identity must agree with actual platform defaults even when no existing entry supplies a direct probe; supplied unit authority cannot verify this native observation.
 * @evidence contracts/e2e.md#shared-execution Both directory shapes execute in the same OS filesystem batch and installed consumer interval; no compiler, Go build, product host or independent installation is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each directory owns one fresh identity transaction and private temporary root, preventing a previous directory's observation from establishing another's authority; no native flag or global fs operation is modified.
 * @evidence contracts/e2e.md#preserved-coverage The original two-shape assertion loop and platform-default premise remain unchanged; sensitive overrides and explicit case authority retain their separate named owners.
 */
export function case_project_input_path_identity_defaults_to_platform_case_semantics(createProjectInputPathIdentityContext: typeof installedOperation = installedOperation) {
    const insensitive =
      process.platform === "win32" || process.platform === "darwin";

    const absent = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-identity-default-")),
      "never-created",
    );
    const empty = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-identity-empty-"),
    );

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
