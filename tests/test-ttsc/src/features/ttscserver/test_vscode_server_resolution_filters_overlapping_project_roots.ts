import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies VS Code server planning rejects overlapping project roots.
 *
 * A parent language client with a recursive selector and a nested package
 * client would both claim the nested file. The pure resolution helper filters
 * ancestor candidates when a more specific descendant root is already known,
 * keeping one owner per document path.
 *
 * 1. Create a workspace root with a nested package, both with tsconfig files.
 * 2. Resolve candidates for an active file in the nested package.
 * 3. Filter overlapping candidates.
 * 4. Assert only the nested package root remains.
 */
export const test_vscode_server_resolution_filters_overlapping_project_roots =
  () => {
    const repo = TestProject.WORKSPACE_ROOT;
    const root = TestProject.tmpdir("vscode-overlapping-roots-");
    const nested = path.join(root, "packages", "demo");
    fs.mkdirSync(path.join(nested, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "tsconfig.json"), "{}\n");
    fs.writeFileSync(path.join(nested, "tsconfig.json"), "{}\n");
    fs.writeFileSync(path.join(nested, "src", "main.ts"), "export {};\n");

    const script = `
      import { pathToFileURL } from "node:url";
      const mod = await import(pathToFileURL(${JSON.stringify(
        path.join(repo, "packages", "vscode", "src", "serverResolution.ts"),
      )}).href);
      const candidates = mod.createResolutionCandidates({
        activeFile: ${JSON.stringify(path.join(nested, "src", "main.ts"))},
        activeWorkspaceRoot: ${JSON.stringify(root)},
        workspaceRoots: [${JSON.stringify(root)}],
      });
      console.log(JSON.stringify(mod.filterNonOverlappingCandidates(candidates).map((entry) => entry.cwd)));
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
