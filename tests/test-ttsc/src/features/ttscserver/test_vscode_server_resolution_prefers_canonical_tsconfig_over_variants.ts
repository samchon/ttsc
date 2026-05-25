import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code server resolution prefers canonical tsconfig names.
 *
 * The helper accepts `tsconfig.*.json` and `jsconfig.*.json` so package-shaped
 * projects work, but a directory containing `tsconfig.json` must use that file
 * first. Otherwise the extension can launch with `tsconfig.app.json` or
 * `jsconfig.json` while the CLI default uses `tsconfig.json`.
 *
 * 1. Create a project containing canonical and variant config files.
 * 2. Import the VS Code resolution helper through Node's TypeScript loader.
 * 3. Assert the candidate selects `tsconfig.json`.
 */
export const test_vscode_server_resolution_prefers_canonical_tsconfig_over_variants =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const project = TestProject.tmpdir("vscode-tsconfig-priority-");
    fs.mkdirSync(path.join(project, "src"), { recursive: true });
    fs.writeFileSync(path.join(project, "src", "main.ts"), "export {};\n");
    for (const name of [
      "jsconfig.json",
      "tsconfig.app.json",
      "tsconfig.json",
    ]) {
      fs.writeFileSync(path.join(project, name), "{}\n");
    }

    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      const candidate = mod.createResolutionCandidates({
        activeFile: ${JSON.stringify(path.join(project, "src", "main.ts"))},
        activeWorkspaceRoot: ${JSON.stringify(project)},
      })[0];
      console.log(candidate.tsconfig);
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
      {
        cwd: repo,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      path.normalize(result.stdout.trim()),
      path.normalize(path.join(project, "tsconfig.json")),
    );
  };
