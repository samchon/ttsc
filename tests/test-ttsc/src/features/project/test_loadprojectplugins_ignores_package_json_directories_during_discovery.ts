import { TestProject } from "../../../../utils/src/TestProject";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadProjectPlugins } from "../../../../../packages/ttsc/src/plugin/internal/load/loadProjectPlugins";

/**
 * Verifies package auto-discovery treats only regular manifests as boundaries.
 *
 * Node ignores a directory named `package.json` and continues to the nearest
 * ancestor file. The loader must make the same selection and retain the nearer
 * directory candidate, because replacing it with a file changes discovery.
 *
 * 1. Create a project whose package.json is a directory below a workspace that
 *    holds a real manifest.
 * 2. Load the project plugins from its tsconfig.
 * 3. Require no native plugins, both candidates among the host inputs and content
 *    hashes only as strings for the real manifest and the directory marker.
 *
 * @evidence contracts/testing.md#behavioral-verification Discovery reports no plugins and records both the nearer directory candidate and ancestor manifest with fingerprints.
 * @evidence contracts/testing.md#independent-expectations Node treats a directory named package.json as a candidate rather than a package boundary; the authored ancestor is the actual manifest.
 * @evidence contracts/testing.md#distinguishing-cases A directory named package.json nearer to the project than an ancestor manifest file is a candidate, not a boundary: discovery selects the ancestor file yet records both paths with string fingerprints, so replacing the directory with a file later changes discovery.
 * @evidence contracts/testing.md#execution-ownership This source unit calls loadProjectPlugins directly on a workspace whose nearer package.json is a directory, before any descriptor evaluation or native build; it asserts no plugins, both recorded host inputs and their fingerprints.
 */
export const test_loadprojectplugins_ignores_package_json_directories_during_discovery =
  () => {
    const workspace = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-package-json-directory-"),
    );
    const project = path.join(workspace, "packages", "app");
    const projectManifest = path.join(project, "package.json");
    const workspaceManifest = path.join(workspace, "package.json");
    fs.mkdirSync(projectManifest, { recursive: true });
    fs.writeFileSync(
      workspaceManifest,
      JSON.stringify({ name: "workspace", private: true }),
      "utf8",
    );
    const tsconfig = path.join(project, "tsconfig.json");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({ compilerOptions: { strict: true } }),
      "utf8",
    );

    const loaded = loadProjectPlugins({ binary: "", tsconfig });

    assert.deepEqual(loaded.nativePlugins, []);
    assert.ok(loaded.hostInputs.includes(projectManifest));
    assert.ok(loaded.hostInputs.includes(workspaceManifest));
    assert.equal(typeof loaded.hostInputHashes[projectManifest], "string");
    assert.equal(typeof loaded.hostInputHashes[workspaceManifest], "string");
  };
