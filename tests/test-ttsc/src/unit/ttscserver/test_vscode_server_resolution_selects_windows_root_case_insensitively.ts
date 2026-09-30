import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies VS Code server root selection is case-insensitive on Windows paths.
 *
 * VS Code can report workspace roots and document paths with different drive or
 * segment casing. Command routing should still choose the deepest matching
 * language client on Windows while preserving normal case-sensitive behavior on
 * POSIX platforms.
 *
 * 1. Import the pure path-selection helper.
 * 2. Select a client root for a differently-cased Windows document path.
 * 3. Assert the nested root is selected.
 *
 * @evidence contracts/testing.md#behavioral-verification selectDeepestRootForPath selects the deepest Windows client despite casing aliases.
 * @evidence contracts/testing.md#independent-expectations ordinary Windows directory identity treats case aliases as equal while deepest containment selects the owner.
 * @evidence contracts/testing.md#distinguishing-cases a mixed-case Windows file is contained by both parent and nested clients and must select the nested owner; sensitive-root counterexamples belong to the Windows identity unit.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_selects_windows_root_case_insensitively function runs under src/unit/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_selects_windows_root_case_insensitively() {
  const repo = TestProject.WORKSPACE_ROOT;
  const observed = (() => {
    return mod.selectDeepestRootForPath(
      "c:\\repo\\packages\\demo\\src\\main.ts",
      ["C:\\Repo", "C:\\Repo\\Packages\\Demo"],
      "win32"
    );
  
  })();
  assert.equal(observed, "C:\\Repo\\Packages\\Demo");
}