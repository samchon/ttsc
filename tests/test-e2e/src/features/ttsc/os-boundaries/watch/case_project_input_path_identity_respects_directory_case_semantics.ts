import { TestProject } from "../../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const childProcess = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import path from "node:path";

import { createProjectInputPathIdentityContext as installedOperation } from "../../../../../../../packages/ttsc/lib/internal/pathIdentity/createProjectInputPathIdentityContext.js";

/**
 * Verifies actual empty-directory case authority follows the volume and Windows sensitive override.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual packed-SDK identity transaction compares a missing suffix under an empty directory to an independently observed marker alias, and a fresh Windows transaction observes the enabled per-directory sensitive flag.
 * @evidence contracts/testing.md#independent-expectations Real fs.existsSync of the marker case alias establishes ordinary-volume authority independently, while successful fsutil enable and distinct suffix keys establish the override contract.
 * @evidence contracts/testing.md#distinguishing-cases Independent ordinary marker alias and actual Windows enabled-sensitive directory retain their original assertions. Existing explicit-authority unit injects realpath/case and does not own these native observations; original non-Windows return after the ordinary row remains.
 * @evidence contracts/testing.md#execution-ownership This supplied candidate or default workspace identity operation is directly invoked over actual native roots/fsutil inputs. Installed import alone is not compiler, plugin or product protocol proof; no watcher starts.
 * @evidenceExclude contracts/e2e.md#necessary-boundary Native filesystem/case-flag inputs belong to direct identity operation ownership. The exact native unit matrix is being authored by test-ttsc; modeled explicit authority or unknown-policy transfer is not its substitute. Donor remains pending actual direct survivor execution.
 * @evidence contracts/e2e.md#shared-execution Existing ordinary and Windows-sensitive rows share one root but use fresh transactions after changed flag authority. This is direct-unit preparation, not achieved E2E consolidation or measured process reduction; no compiler/Go build is called.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before native setup. Private Windows flag is not a global replacement; actual fsutil error/signal/status must succeed before sensitive assertions, and synchronous return does not establish arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Original marker-alias equality and enabled-sensitive Spec.md/spec.md inequality with original final Marker.txt write remain. Exact new direct native body/selection/runtime/survival is not yet established; portable modeled unit cannot certify the native matrix.
 */
export function case_project_input_path_identity_respects_directory_case_semantics(createProjectInputPathIdentityContext: typeof installedOperation = installedOperation) {
    const actualRoot = TestProject.tmpdir(
      "ttsc-project-input-empty-case-semantics-",
    );
    TestProject.retainTemporaryDirectory(actualRoot, "native case flag helper has no descendant join acknowledgement");
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
    assert.equal(enabled.error, undefined, "native sensitive-flag launch error");
    assert.equal(enabled.signal, null, "native sensitive-flag helper terminated by signal");
    assert.equal(enabled.status, 0, enabled.error?.message ?? enabled.stderr);
    const sensitiveActual = createProjectInputPathIdentityContext();
    assert.notEqual(
      sensitiveActual.resolve(path.join(sensitiveRoot, "Spec.md")).key,
      sensitiveActual.resolve(path.join(sensitiveRoot, "spec.md")).key,
      "an empty sensitive directory must not depend on localized fsutil text",
    );
    fs.writeFileSync(path.join(sensitiveRoot, "Marker.txt"), "", "utf8");
}
