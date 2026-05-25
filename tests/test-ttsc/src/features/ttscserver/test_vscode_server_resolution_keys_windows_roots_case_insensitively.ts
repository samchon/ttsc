import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Verifies VS Code client root keys are case-insensitive on Windows.
 *
 * VS Code and Node can report the same Windows workspace root with different
 * drive-letter casing. The extension keys running clients by canonical root so
 * it does not stop and restart the same project unnecessarily.
 *
 * 1. Import the pure server resolution helper.
 * 2. Key the same Windows root with different casing.
 * 3. Plan the roots with the Windows platform override.
 * 4. Assert the keys match and planning keeps one root.
 */
export const test_vscode_server_resolution_keys_windows_roots_case_insensitively =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      const upper = "C:\\\\Repo";
      const lower = "c:\\\\repo";
      console.log(JSON.stringify({
        sameKey: mod.rootKey(upper, "win32") === mod.rootKey(lower, "win32"),
        planned: mod.planNonOverlappingClientRoots([upper, lower], undefined, "win32"),
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
      planned: string[];
      sameKey: boolean;
    };
    assert.equal(actual.sameKey, true);
    assert.equal(actual.planned.length, 1);
  };
