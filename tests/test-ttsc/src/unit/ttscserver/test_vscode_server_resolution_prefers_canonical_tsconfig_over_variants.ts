import * as mod from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
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
 * 2. Call the authored VS Code resolution helper in the unit process.
 * 3. Assert the candidate selects `tsconfig.json`.
 *
 * @evidence contracts/testing.md#behavioral-verification createResolutionCandidates selects the existing canonical tsconfig over variant and jsconfig files.
 * @evidence contracts/testing.md#independent-expectations default CLI project selection prefers tsconfig.json; literal filename is the independent oracle.
 * @evidence contracts/testing.md#distinguishing-cases a fixture contains all three candidates and the selected result must exist and name the canonical file.
 * @evidence contracts/testing.md#execution-ownership The named test_vscode_server_resolution_prefers_canonical_tsconfig_over_variants function runs under src/unit/ttscserver and calls authored serverResolution functions directly; fixture manifests are resolver input, and no language client or product process starts.
 */
export function test_vscode_server_resolution_prefers_canonical_tsconfig_over_variants() {
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
  const observed = (() => {
    const candidate = mod.createResolutionCandidates({
      activeFile: (path.join(project, "src", "main.ts")),
      activeWorkspaceRoot: (project),
    })[0]!;
    return candidate.tsconfig;
  
  })();
  assert.ok(typeof observed === "string", "the selected config must exist");
  assert.equal(
    path.normalize(observed),
    path.normalize(path.join(project, "tsconfig.json")),
  );
}