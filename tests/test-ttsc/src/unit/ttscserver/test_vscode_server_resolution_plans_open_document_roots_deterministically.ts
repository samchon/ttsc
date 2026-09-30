import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies VS Code open-document root planning is order independent.
 *
 * VS Code exposes `workspace.textDocuments` as an array, but overlapping
 * language clients cannot coexist because their recursive selectors would both
 * claim nested files. Planning must converge on the same root set regardless of
 * the order documents were opened.
 *
 * 1. Call the authored server resolution helper in the unit process.
 * 2. Plan a parent and nested root in both input orders.
 * 3. Repeat with the parent root preferred as the active document root.
 * 4. Assert each pair produces the same planned roots.
 *
 * @evidence contracts/testing.md#behavioral-verification planNonOverlappingClientRoots returns identical literal root sets in both input orders.
 * @evidence contracts/testing.md#independent-expectations one owner per path requires nested roots without preference and the preferred parent when active.
 * @evidence contracts/testing.md#distinguishing-cases both parent-first and nested-first orderings are repeated with and without active preference.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_plans_open_document_roots_deterministically function runs under src/unit/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_plans_open_document_roots_deterministically() {
  const repo = TestProject.WORKSPACE_ROOT;
  const root = path.join(repo, "tmp", "repo");
  const nested = path.join(root, "packages", "demo");
  const observed = (() => {
    return {
      unpreferredA: mod.planNonOverlappingClientRoots([(root), (nested)]),
      unpreferredB: mod.planNonOverlappingClientRoots([(nested), (root)]),
      preferredA: mod.planNonOverlappingClientRoots([(root), (nested)], (root)),
      preferredB: mod.planNonOverlappingClientRoots([(nested), (root)], (root)),
    };
  
  })();
  const actual = observed as {
    preferredA: string[];
    preferredB: string[];
    unpreferredA: string[];
    unpreferredB: string[];
  };
  assert.deepEqual(
    actual.unpreferredA.map((entry) => path.normalize(entry)),
    [path.normalize(nested)],
  );
  assert.deepEqual(
    actual.unpreferredB.map((entry) => path.normalize(entry)),
    [path.normalize(nested)],
  );
  assert.deepEqual(
    actual.preferredA.map((entry) => path.normalize(entry)),
    [path.normalize(root)],
  );
  assert.deepEqual(
    actual.preferredB.map((entry) => path.normalize(entry)),
    [path.normalize(root)],
  );
}