import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { TestProject } from "@ttsc/testing";

/**
 * Verify the release validator CLI transports success and rejection diagnostics.
 *
 * Complete and empty Windows-layout source packages make this command contract
 * portable without relying on the host's executable mode representation. Source
 * units own every original POSIX archive and Windows contents variant.
 *
 * @evidence contracts/testing.md#behavioral-verification The complete artifact exits zero with empty stdout/stderr; the empty artifact exits one, writes all five independently authored missing-path diagnostics to stderr, and leaves stdout empty.
 * @evidence contracts/testing.md#independent-expectations The fixed five published Windows base paths and literal package label determine exact stderr independently of validatePlatformPackages; no production formatter supplies expected text.
 * @evidence contracts/testing.md#distinguishing-cases Positive and negative process dispatch share one owned fixture; the named source-unit POSIX modes and Windows contents cases retain every original archive, manifest and required-file distinction.
 * @evidence contracts/testing.md#execution-ownership This feature owns two Node CLI invocations, while matching unit/platform cases exercise all semantic variants directly with the public release validator operation.
 * @evidence contracts/e2e.md#necessary-boundary Direct validation cannot certify require.main dispatch, process exit status or stderr/stdout transport; actual Node children establish those connections.
 * @evidence contracts/e2e.md#shared-execution One fixture batch and existing Node executable cover positive/negative CLI statuses without per-row installations, native producers or semantic-row child processes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Separate complete/empty directories preserve their immutable inputs through synchronous child completion; TestProject owns both under one tracked temporary root.
 * @evidence contracts/e2e.md#preserved-coverage Original semantic assertion populations moved to test_platform_package_tarball_requires_posix_executable_modes and test_platform_package_windows_contents_require_base_executables source units; this boundary retains zero/one exits and strengthens exact stderr and empty stdout checks.
 */
export function test_platform_package_verifier_reports_validation_exit_and_diagnostics(): void {
  const root = TestProject.tmpdir("ttsc-platform-verifier-");
  const paths = ["bin/ttsc.exe", "bin/ttscserver.exe", "bin/ttscgraph.exe", "bin/go/bin/go.exe", "bin/go/bin/gofmt.exe"];
  const good = path.join(root, "complete");
  const bad = path.join(root, "empty");
  for (const directory of [good, bad]) {
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: "@ttsc/win32-x64", version: "0.0.0" }));
  }
  for (const relative of paths) {
    const file = path.join(good, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "published executable fixture");
  }
  const script = path.join(TestProject.WORKSPACE_ROOT, "scripts", "assert-platform-package.cjs");
  for (const [directory, status, stderr] of [
    [good, 0, ""],
    [bad, 1, paths.map((relative) => `@ttsc/win32-x64: missing executable ${relative}\n`).join("")],
  ] as const) {
    const result = spawnSync(process.execPath, [script, directory], { encoding: "utf8", windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, status, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, stderr);
  }
}
