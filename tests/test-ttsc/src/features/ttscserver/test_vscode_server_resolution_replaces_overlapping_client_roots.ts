import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Verifies VS Code dynamic client planning replaces overlapping roots.
 *
 * The extension may first start a nested package server, then later need a
 * parent server for a sibling file outside that nested package. Because VS Code
 * document selectors cannot exclude the nested subtree, the extension stops
 * overlapping clients before starting the newly selected root.
 *
 * 1. Import the pure server resolution helper.
 * 2. Ask which roots overlap a parent target.
 * 3. Ask which roots overlap a nested target.
 * 4. Assert only overlapping roots are selected for replacement.
 */
export const test_vscode_server_resolution_replaces_overlapping_client_roots =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const root = path.join(repo, "tmp", "repo");
    const nested = path.join(root, "packages", "demo");
    const sibling = path.join(root, "tools");
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      console.log(JSON.stringify({
        parent: mod.rootsToStopForTarget([${JSON.stringify(nested)}], ${JSON.stringify(root)}),
        child: mod.rootsToStopForTarget([${JSON.stringify(root)}, ${JSON.stringify(sibling)}], ${JSON.stringify(nested)}),
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
      child: string[];
      parent: string[];
    };
    assert.deepEqual(
      actual.parent.map((entry) => path.normalize(entry)),
      [path.normalize(nested)],
    );
    assert.deepEqual(
      actual.child.map((entry) => path.normalize(entry)),
      [path.normalize(root)],
    );
  };
