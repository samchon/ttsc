import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx resolves extensionless imports inside a symlinked workspace raw
 * `.ts` dependency.
 *
 * A pnpm-style workspace dependency is a `node_modules` symlink whose realpath
 * lives outside `node_modules`, so Node strips its types natively but rejects
 * the source's extensionless relative imports with `ERR_MODULE_NOT_FOUND`.
 * ttsx's runtime `resolve` hook must probe the candidate extensions and rescue
 * the import without any change to the dependency.
 *
 * 1. Create an ESM project plus a `ws-dep` package whose `index.ts` does `import
 *    "./util"` (no extension), symlinked into `node_modules`.
 * 2. Run ttsx against an entry importing the dependency.
 * 3. Assert the dependency executed and produced its greeting.
 * @evidence contracts/testing.md#behavioral-verification Loads a symlinked ESM workspace dependency whose index imports ./util without an extension and requires hello-workspace.
 * @evidence contracts/testing.md#independent-expectations The authored util value determines the literal output independently of extension probing.
 * @evidence contracts/testing.md#distinguishing-cases The physical workspace source lies outside node_modules while its logical package link is inside; link creation failure is an actual test failure.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_resolves_extensionless_imports_in_a_symlinked_workspace_raw_ts_dependency at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Native dependency lowering, real filesystem alias resolution and Node extensionless rescue execute in one host.
 * @evidence contracts/e2e.md#shared-execution One project links one authored package and runs one ttsx child using shared installed compiler preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The link and target are fixture-owned and immutable; synchronous host completion precedes harness process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The exact runtime output and actual symlink creation remain here; no portable path-only unit is inferred as equivalent.
 */
export function test_ttsx_resolves_extensionless_imports_in_a_symlinked_workspace_raw_ts_dependency() {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_resolves_extensionless_imports_in_a_symlinked_workspace_raw_ts_dependency/inputs-1"));
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
    fs.symlinkSync(
      path.join(root, "packages", "ws-dep"),
      path.join(root, "node_modules", "ws-dep"),
      "junction",
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "hello-workspace");
  }
