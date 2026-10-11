import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the installed project-input identity inherits an empty directory's
 * case semantics, including a Windows case-sensitive directory.
 *
 * The source unit
 * `test_project_input_path_identity_respects_directory_case_semantics` owns
 * this contract for the authored operation; this case runs the
 * `ttsc/path-identity` export the packed SDK publishes.
 *
 * 1. Create a marker and an empty directory; a real `mARKER.TXT` alias check gives
 *    the volume's case semantics independently of the operation.
 * 2. Require missing `Spec.md` and `spec.md` under the empty directory to share a
 *    key exactly when the volume folds case.
 * 3. On Windows, enable case sensitivity on a fresh empty directory with `fsutil`
 *    and require a fresh context to keep the two names apart.
 *
 * @evidence contracts/testing.md#behavioral-verification The installed context's keys for two missing spellings are compared with the volume's real alias behavior, and with an actually case-sensitive Windows directory.
 * @evidence contracts/testing.md#independent-expectations Native existence of the marker alias and fsutil's own success establish each expectation; nothing is read from the operation's own case answer.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary empty-directory inheritance on every platform contrasts with the Windows sensitive empty directory.
 * @evidence contracts/testing.md#execution-ownership test_e2e_installation passes the operation its packed SDK publishes; the case runs fsutil only on Windows and starts no compiler or product host.
 * @evidence contracts/e2e.md#necessary-boundary The packed SDK's public path-identity export must agree with native case behavior; the source unit cannot establish what the installation publishes.
 * @evidence contracts/e2e.md#shared-execution One installation serves every installed-operation case of its entry.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns a fresh tracked root; fresh contexts keep one directory's answer from deciding another's.
 * @evidence contracts/e2e.md#preserved-coverage Restores the installed-publication run the installation entry names, whose assertions the source unit keeps.
 */
export function case_project_input_path_identity_respects_directory_case_semantics(
  createProjectInputPathIdentityContext: () => {
    resolve(file: string): { key: string };
  },
): void {
  const root = TestProject.tmpdir("ttsc-installed-case-semantics-");
  const ordinary = path.join(root, "ordinary");
  fs.mkdirSync(ordinary);
  fs.writeFileSync(path.join(root, "Marker.txt"), "", "utf8");
  const folds = fs.existsSync(path.join(root, "mARKER.TXT"));
  const context = createProjectInputPathIdentityContext();
  assert.equal(
    context.resolve(path.join(ordinary, "Spec.md")).key ===
      context.resolve(path.join(ordinary, "spec.md")).key,
    folds,
    "an empty directory must inherit its volume's case semantics",
  );

  if (process.platform !== "win32") return;
  const sensitive = path.join(root, "sensitive");
  fs.mkdirSync(sensitive);
  const enabled = childProcess.spawnSync(
    "fsutil.exe",
    ["file", "setCaseSensitiveInfo", sensitive, "enable"],
    { encoding: "utf8", windowsHide: true },
  );
  const result = JSON.stringify({
    error: enabled.error?.message,
    signal: enabled.signal,
    status: enabled.status,
    stdout: enabled.stdout,
    stderr: enabled.stderr,
  });
  assert.equal(enabled.error, undefined, `fsutil preparation error: ${result}`);
  assert.equal(enabled.signal, null, `fsutil signal termination: ${result}`);
  assert.equal(enabled.status, 0, `fsutil exit: ${result}`);
  const sensitiveContext = createProjectInputPathIdentityContext();
  assert.notEqual(
    sensitiveContext.resolve(path.join(sensitive, "Spec.md")).key,
    sensitiveContext.resolve(path.join(sensitive, "spec.md")).key,
    "an empty case-sensitive directory must keep both spellings apart",
  );
}
