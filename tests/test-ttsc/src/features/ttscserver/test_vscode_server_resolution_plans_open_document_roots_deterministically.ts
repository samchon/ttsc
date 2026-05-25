import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Verifies VS Code open-document root planning is order independent.
 *
 * VS Code exposes `workspace.textDocuments` as an array, but overlapping
 * language clients cannot coexist because their recursive selectors would both
 * claim nested files. Planning must converge on the same root set regardless of
 * the order documents were opened.
 *
 * 1. Import the pure server resolution helper.
 * 2. Plan a parent and nested root in both input orders.
 * 3. Repeat with the parent root preferred as the active document root.
 * 4. Assert each pair produces the same planned roots.
 */
export const test_vscode_server_resolution_plans_open_document_roots_deterministically =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const root = path.join(repo, "tmp", "repo");
    const nested = path.join(root, "packages", "demo");
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      console.log(JSON.stringify({
        unpreferredA: mod.planNonOverlappingClientRoots([${JSON.stringify(root)}, ${JSON.stringify(nested)}]),
        unpreferredB: mod.planNonOverlappingClientRoots([${JSON.stringify(nested)}, ${JSON.stringify(root)}]),
        preferredA: mod.planNonOverlappingClientRoots([${JSON.stringify(root)}, ${JSON.stringify(nested)}], ${JSON.stringify(root)}),
        preferredB: mod.planNonOverlappingClientRoots([${JSON.stringify(nested)}, ${JSON.stringify(root)}], ${JSON.stringify(root)}),
      }));
    `;
    const result = spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--experimental-transform-types",
        "--input-type=module",
        "--eval",
        script,
      ],
      { cwd: repo, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout) as {
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
  };
