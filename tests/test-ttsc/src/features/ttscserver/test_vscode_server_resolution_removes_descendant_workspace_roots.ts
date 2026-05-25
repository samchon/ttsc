import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Verifies VS Code workspace removal stops descendant server roots.
 *
 * A language client can be rooted at a nested tsconfig under the workspace
 * folder that was removed. Stopping only exact root matches would leave that
 * client alive after the owning workspace folder disappeared.
 *
 * 1. Import the pure server resolution helper.
 * 2. Provide one removed workspace root with a nested client and a sibling.
 * 3. Ask which clients are inside the removed root.
 * 4. Assert the descendant is selected and the sibling is preserved.
 */
export const test_vscode_server_resolution_removes_descendant_workspace_roots =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const removed = path.join(repo, "tmp", "repo");
    const nested = path.join(removed, "packages", "demo");
    const sibling = path.join(repo, "tmp", "other");
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      console.log(JSON.stringify(mod.rootsInsideRemovedWorkspace([
        ${JSON.stringify(nested)},
        ${JSON.stringify(sibling)}
      ], ${JSON.stringify(removed)})));
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
    assert.deepEqual(
      (JSON.parse(result.stdout) as string[]).map((entry) =>
        path.normalize(entry),
      ),
      [path.normalize(nested)],
    );
  };
