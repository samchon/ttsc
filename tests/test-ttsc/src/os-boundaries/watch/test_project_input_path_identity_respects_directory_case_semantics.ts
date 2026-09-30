import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { createProjectInputPathIdentityContext as installedOperation } from "../../../../../packages/ttsc/lib/internal/pathIdentity/createProjectInputPathIdentityContext.js";

/**
 * Verifies actual empty-directory case authority follows the volume and Windows sensitive override.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual packed-SDK identity transaction compares a missing suffix under an empty directory to an independently observed marker alias, and a fresh Windows transaction observes the enabled per-directory sensitive flag.
 * @evidence contracts/testing.md#independent-expectations Real fs.existsSync of the marker case alias establishes ordinary-volume authority independently, while successful fsutil enable and distinct suffix keys establish the override contract.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary empty-directory inheritance and Windows empty sensitive override retain their original actual assertions. Portable alias, suffix and UNC cases execute in test_project_input_path_identity_respects_explicit_directory_case_authority.
 * @evidence contracts/testing.md#execution-ownership The named os-boundaries/watch entry executes the shipped identity resolver against actual private volume directories and the real Windows fsutil command in the sole installation matrix; it does not claim simulated operations prove native semantics.
 * @evidence contracts/e2e.md#necessary-boundary Actual Node filesystem case behavior and Windows directory flag observation must agree with the resolver's native authority; pure injected authority cannot prove this connection.
 * @evidence contracts/e2e.md#shared-execution Ordinary and Windows-sensitive observations share one private fixture root and shipped identity implementation; the Windows flag transition alone requires a new transaction because its authority changed, with no compiler or Go build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private directories isolate the enabled flag from other fixtures; separate transactions distinguish ordinary authority from the changed sensitive authority. No fs method is replaced and no watcher/process lifetime is retained.
 * @evidence contracts/e2e.md#preserved-coverage Both original actual-volume assertions remain here unchanged, and the portable assertion body executes mechanically unchanged in its named authored-source unit.
 */
export function test_project_input_path_identity_respects_directory_case_semantics(createProjectInputPathIdentityContext: typeof installedOperation = installedOperation) {
    const actualRoot = TestProject.tmpdir(
      "ttsc-project-input-empty-case-semantics-",
    );
    const insensitiveRoot = path.join(actualRoot, "insensitive");
    fs.mkdirSync(insensitiveRoot);
    fs.writeFileSync(path.join(actualRoot, "Marker.txt"), "", "utf8");
    const actual = createProjectInputPathIdentityContext();
    const markerAliasExists = fs.existsSync(
      path.join(actualRoot, "mARKER.TXT"),
    );
    assert.equal(
      actual.resolve(path.join(insensitiveRoot, "Spec.md")).key ===
        actual.resolve(path.join(insensitiveRoot, "spec.md")).key,
      markerAliasExists,
      "an empty directory must inherit its volume's case semantics",
    );

    if (process.platform !== "win32") return;
    const sensitiveRoot = path.join(actualRoot, "sensitive");
    fs.mkdirSync(sensitiveRoot);
    const enabled = childProcess.spawnSync(
      "fsutil.exe",
      ["file", "setCaseSensitiveInfo", sensitiveRoot, "enable"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(enabled.status, 0, enabled.error?.message ?? enabled.stderr);
    const sensitiveActual = createProjectInputPathIdentityContext();
    assert.notEqual(
      sensitiveActual.resolve(path.join(sensitiveRoot, "Spec.md")).key,
      sensitiveActual.resolve(path.join(sensitiveRoot, "spec.md")).key,
      "an empty sensitive directory must not depend on localized fsutil text",
    );
    fs.writeFileSync(path.join(sensitiveRoot, "Marker.txt"), "", "utf8");
}
