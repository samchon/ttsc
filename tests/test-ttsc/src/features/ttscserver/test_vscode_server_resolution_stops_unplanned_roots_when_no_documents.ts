import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Verifies VS Code server planning stops stale roots when no roots are planned.
 *
 * Closing the last supported document can leave no planned client roots. In
 * that case the extension should stop existing language clients instead of
 * keeping idle `ttscserver` processes alive until deactivation.
 *
 * 1. Import the pure server resolution helper.
 * 2. Ask which roots to stop when the planned-root set is empty.
 * 3. Ask which roots to stop when one overlapping parent root replaces a child.
 * 4. Assert every unplanned running root is stopped.
 */
export const test_vscode_server_resolution_stops_unplanned_roots_when_no_documents =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const root = path.join(repo, "tmp", "repo");
    const nested = path.join(root, "packages", "demo");
    const unrelated = path.join(repo, "tmp", "outside-tools");
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      console.log(JSON.stringify({
        empty: mod.rootsToStopForPlan([${JSON.stringify(nested)}, ${JSON.stringify(unrelated)}], []),
        parent: mod.rootsToStopForPlan([${JSON.stringify(nested)}, ${JSON.stringify(unrelated)}], [${JSON.stringify(root)}]),
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
      empty: string[];
      parent: string[];
    };
    assert.deepEqual(
      actual.empty.map((entry) => path.normalize(entry)),
      [path.normalize(nested), path.normalize(unrelated)],
    );
    assert.deepEqual(
      actual.parent.map((entry) => path.normalize(entry)),
      [path.normalize(nested), path.normalize(unrelated)],
    );
  };
