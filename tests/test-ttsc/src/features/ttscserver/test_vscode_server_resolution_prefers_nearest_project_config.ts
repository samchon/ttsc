import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code server resolution prefers the nearest project config root.
 *
 * Active editors usually live under `src/`, but spawning `ttscserver` from that
 * directory makes relative project discovery depend on the opened file. This
 * pins the helper that walks upward to the owning `tsconfig*.json` without
 * escaping the workspace folder.
 *
 * 1. Create a workspace with a nested package and an active-file directory.
 * 2. Import the VS Code resolution helper through Node's TypeScript loader.
 * 3. Assert the candidate keeps `src/` as the module-resolution base but uses the
 *    package root as cwd.
 */
export const test_vscode_server_resolution_prefers_nearest_project_config =
  () => {
    const root = TestProject.WORKSPACE_ROOT;
    const workspace = TestProject.tmpdir("vscode-server-project-root-");
    const project = path.join(workspace, "packages", "demo");
    const source = path.join(project, "src");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "main.ts"), "export {};\n");
    fs.writeFileSync(path.join(project, "tsconfig.app.json"), "{}\n");
    fs.mkdirSync(path.join(workspace, "unconfigured", "src"), {
      recursive: true,
    });

    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(root, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      const candidate = mod.createResolutionCandidates({
        activeFile: ${JSON.stringify(path.join(source, "main.ts"))},
        activeWorkspaceRoot: ${JSON.stringify(workspace)},
        workspaceRoots: [${JSON.stringify(workspace)}],
      })[0];
      const noEscape = mod.findProjectRoot(${JSON.stringify(
        path.join(workspace, "unconfigured", "src"),
      )}, ${JSON.stringify(workspace)}) ?? "";
      console.log(JSON.stringify({ candidate, noEscape }));
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
        cwd: root,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as {
      candidate?: { cwd?: string; resolveFrom?: string };
      noEscape?: string;
    };
    assert.equal(
      path.normalize(parsed.candidate?.cwd ?? ""),
      path.normalize(project),
    );
    assert.equal(
      path.normalize(parsed.candidate?.resolveFrom ?? ""),
      path.normalize(source),
    );
    assert.equal(parsed.noEscape, "");
  };
