import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
 */
export const test_vscode_server_resolution_selects_windows_root_case_insensitively =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      console.log(mod.selectDeepestRootForPath(
        "c:\\\\repo\\\\packages\\\\demo\\\\src\\\\main.ts",
        ["C:\\\\Repo", "C:\\\\Repo\\\\Packages\\\\Demo"],
        "win32"
      ));
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
    assert.equal(result.stdout.trim(), "C:\\Repo\\Packages\\Demo");
  };
