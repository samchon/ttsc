import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Verifies VS Code server planning stops unplanned non-overlapping roots.
 *
 * Closing the last document in one workspace root should stop that root's
 * language client even when another unrelated root still has an open document.
 * Otherwise the closed root leaves an idle `ttscserver` process behind until
 * deactivation.
 *
 * 1. Import the pure server resolution helper.
 * 2. Create two unrelated running roots.
 * 3. Plan only the first root.
 * 4. Assert the second root is selected for shutdown.
 */
export const test_vscode_server_resolution_stops_unplanned_non_overlapping_roots =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const rootA = path.join(repo, "tmp", "root-a");
    const rootB = path.join(repo, "tmp", "root-b");
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      console.log(JSON.stringify({
        stopped: mod.rootsToStopForPlan([${JSON.stringify(rootA)}, ${JSON.stringify(rootB)}], [${JSON.stringify(rootA)}]),
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
    const actual = JSON.parse(result.stdout) as { stopped: string[] };
    assert.deepEqual(
      actual.stopped.map((entry) => path.normalize(entry)),
      [path.normalize(rootB)],
    );
  };
