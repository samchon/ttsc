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
 * @evidence contracts/testing.md#behavioral-verification Discovery reports no plugins and records both the nearer directory candidate and ancestor manifest with fingerprints.
 * @evidence contracts/testing.md#independent-expectations Node treats a directory named package.json as a candidate rather than a package boundary; the authored ancestor is the actual manifest.
 * @evidence contracts/testing.md#distinguishing-cases Discovery reports no plugins and records both the nearer directory candidate and ancestor manifest with fingerprints.
 * @evidence contracts/testing.md#execution-ownership This source unit calls loadProjectPlugins directly before any descriptor evaluation or native build: no plugin is discovered, or the malformed manifest stops discovery. Every original input fingerprint and diagnostic assertion remains.
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
