import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createProjectInputPathIdentityContext";

/**
 * Retains actual empty-directory case inheritance and Windows sensitive input.
 *
 * A real marker alias supplies the ordinary-volume expectation independently of
 * the resolver. Windows then enables the native directory flag and creates a
 * fresh context before resolving missing suffixes under that empty directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Imports the actual project-input identity entry and compares missing Spec.md/spec.md keys under the original empty ordinary directory to real Marker.txt/mARKER.TXT alias existence. Windows actual fsutil enable must succeed before a fresh context returns distinct sensitive suffix keys, followed by the original Marker.txt write.
 * @evidence contracts/testing.md#independent-expectations Native fs.existsSync observes the marker alias independently; actual fsutil exit success establishes the sensitive fixture premise. No expected policy is read from the SUT's caseSensitive method, and unknown observation is not accepted as proof of native capability.
 * @evidence contracts/testing.md#distinguishing-cases Preserves ordinary empty-directory inheritance on every original platform and the Windows-only sensitive empty-directory transition. The late sensitive marker does not supply the earlier authority. Injected explicit authority and the separate observed-mode consistency unit do not own these native observations.
 * @evidence contracts/testing.md#execution-ownership This source unit calls the owning operation against a private native root and the real Windows fsutil command, without a consumer install, compiler, Go artifact, foreign replacement or errno stub. Command preparation errors/signals and nonzero exits retain raw results separately; native body existence certifies neither execution nor classifier correctness. Finally attempts root cleanup and retains cleanup failure with observation failure.
 */
export function test_project_input_path_identity_respects_directory_case_semantics(): void {
  const actualRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-project-input-empty-case-semantics-"),
  );
  const failures: Error[] = [];
  try {
    exercise();
  } catch (cause) {
    failures.push(
      new Error("native directory case inputs and observations", { cause }),
    );
  } finally {
    try {
      fs.rmSync(actualRoot, { recursive: true, force: true });
    } catch (cause) {
      failures.push(new Error("native directory case root cleanup", { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "native directory case observations failed",
    );

  function exercise(): void {
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
      { encoding: "utf8", windowsHide: true },
    );
    const result = JSON.stringify({
      directory: sensitiveRoot,
      error: enabled.error?.message,
      signal: enabled.signal,
      status: enabled.status,
      stdout: enabled.stdout,
      stderr: enabled.stderr,
    });
    assert.equal(
      enabled.error,
      undefined,
      `fsutil preparation error: ${result}`,
    );
    assert.equal(enabled.signal, null, `fsutil signal termination: ${result}`);
    assert.equal(enabled.status, 0, `fsutil exit: ${result}`);
    const sensitiveActual = createProjectInputPathIdentityContext();
    assert.notEqual(
      sensitiveActual.resolve(path.join(sensitiveRoot, "Spec.md")).key,
      sensitiveActual.resolve(path.join(sensitiveRoot, "spec.md")).key,
      "an empty sensitive directory must not depend on localized fsutil text",
    );
    fs.writeFileSync(path.join(sensitiveRoot, "Marker.txt"), "", "utf8");
  }
}
