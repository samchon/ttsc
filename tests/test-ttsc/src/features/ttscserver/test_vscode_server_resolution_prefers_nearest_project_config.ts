import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
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
 * 2. Call the authored VS Code resolution helper in the unit process.
 * 3. Assert the candidate keeps `src/` as the module-resolution base but uses the
 *    package root as cwd.
 *
 * @evidence contracts/testing.md#behavioral-verification createResolutionCandidates finds the nearest configured package and findProjectRoot stays inside the workspace boundary.
 * @evidence contracts/testing.md#independent-expectations project discovery belongs to the nearest configured ancestor and cannot escape an explicit workspace.
 * @evidence contracts/testing.md#distinguishing-cases configured nested source contrasts with an unconfigured subtree under the same workspace.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_prefers_nearest_project_config function runs under src/features/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_prefers_nearest_project_config() {
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

  const observed = (() => {
    const candidate = mod.createResolutionCandidates({
      activeFile: (path.join(source, "main.ts")),
      activeWorkspaceRoot: (workspace),
      workspaceRoots: [(workspace)],
    })[0]!;
    const noEscape = mod.findProjectRoot((path.join(workspace, "unconfigured", "src")), (workspace)) ?? "";
    return { candidate, noEscape };
  
  })();
  const parsed = observed as {
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
}