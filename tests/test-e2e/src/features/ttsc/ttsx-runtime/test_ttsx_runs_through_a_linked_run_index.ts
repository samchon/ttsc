import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";

/**
 * Verifies a run reached through a linked index can claim and clean its output.
 *
 * Pinning `project` to its physical target changes the generation path's
 * parent. The child preload must still use the launcher's runtime lock rather
 * than deriving that lock from a parent directory named `project`.
 *
 * 1. Point an explicit cache's run index at another directory through a link.
 * 2. Run a TypeScript entry and require its checked JavaScript to execute.
 * 3. Assert normal cleanup removes the physical generation.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsx must execute the checked linked-run entry through an external physical run index and leave that index empty after successful completion.
 * @evidence contracts/testing.md#independent-expectations The literal linked-run output proves user execution, while an empty physical directory independently proves cleanup reached the pinned generation rather than only unlinking the alias.
 * @evidence contracts/testing.md#distinguishing-cases A run index outside the cache changes the generation parent while preserving the launcher runtime lock; failed retarget cleanup and live descendant retention belong to separate cases.
 * @evidence contracts/testing.md#execution-ownership The matching named E2E entry owns one real ttsx launcher/program connection with a Windows junction or POSIX directory link.
 * @evidence contracts/e2e.md#necessary-boundary Child owner preload and launcher cleanup must agree on runtime lock identity even when physical generation ancestry changes; direct path classification alone cannot show successful startup.
 * @evidence contracts/e2e.md#shared-execution One project, one linked index and one checked run provide the required connection; existing compiler artifacts are used with no plugin installation or additional host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh dedicated physical index starts empty, and the successful host must remove its own generation; TestProject owns fixture directories and links on failure.
 * @evidence contracts/e2e.md#preserved-coverage Zero status, exact user output and empty physical index assertions remain here; this case proves successful linked execution rather than alias-retarget failure behavior.
 */
export function test_ttsx_runs_through_a_linked_run_index(): void {
  const root = TestProject.tmpdir("ttsx-linked-run-index-");
  const project = path.join(root, "project");
  const cache = path.join(root, "cache");
  const physicalRuns = path.join(root, "physical-runs");
  TestProject.writeFiles(
    project,
    FixtureFiles.read("ttsc/ttsx_runs_through_a_linked_run_index/inputs-1"),
  );
  fs.mkdirSync(cache);
  fs.mkdirSync(physicalRuns);
  fs.symlinkSync(
    physicalRuns,
    path.join(cache, "project"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", project, "--cache-dir", cache, "src/main.ts"],
    { cwd: project },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "linked-run");
  assert.deepEqual(fs.readdirSync(physicalRuns), []);
}
