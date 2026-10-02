import { TestProject } from "../../../../utils/src/TestProject";

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadProjectPlugins } from "../../../../../packages/ttsc/src/plugin/internal/load/loadProjectPlugins";

/**
 * Verifies package auto-discovery treats only regular manifests as boundaries.
 *
 * Package discovery continues past a directory named `package.json` to the nearest
 * ancestor file. The loader must retain the nearer
 * directory candidate, because replacing it with a file changes discovery.
 *
 * 1. Create a project whose package.json is a directory below a workspace that
 *    holds a real manifest.
 * 2. Load the project plugins from its tsconfig.
 * 3. Require no native plugins, both candidates among the host inputs and content
 *    hashes matching the authored manifest bytes and directory marker.
 * 4. Replace the nearer directory with a manifest and require discovery to stop there.
 *
 * @evidence contracts/testing.md#behavioral-verification Discovery reports no plugins and records the nearer directory plus ancestor manifest with exact fingerprints; replacing the directory with a regular manifest removes the unconsulted ancestor from host inputs and proofs.
 * @evidence contracts/testing.md#independent-expectations Manifest boundaries require regular files. Independent SHA-256 over authored bytes and the declared directory domain marker constrain the proofs, while the nearer regular file must stop the candidate search before the ancestor.
 * @evidence contracts/testing.md#distinguishing-cases The same selected project first has a nearer directory and then a nearer regular manifest. Both loads have no plugins; exact hashes distinguish directory kind from file bytes, and ancestor inclusion versus absence distinguishes discovery's stopping boundary.
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
    const workspaceBytes = JSON.stringify({ name: "workspace", private: true });
    fs.writeFileSync(workspaceManifest, workspaceBytes, "utf8");
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
    const digest = (bytes: string): string => crypto.createHash("sha256").update(bytes).digest("hex");
    assert.equal(loaded.hostInputHashes[projectManifest], digest("ttsc:host-input:directory\0"));
    assert.equal(loaded.hostInputHashes[workspaceManifest], digest(workspaceBytes));
    fs.rmdirSync(projectManifest);
    const projectBytes = JSON.stringify({ name: "project", private: true });
    fs.writeFileSync(projectManifest, projectBytes, "utf8");
    const local = loadProjectPlugins({ binary: "", tsconfig });
    assert.deepEqual(local.nativePlugins, []);
    assert.ok(local.hostInputs.includes(projectManifest));
    assert.equal(local.hostInputHashes[projectManifest], digest(projectBytes));
    assert.equal(local.hostInputs.includes(workspaceManifest), false);
    assert.equal(Object.hasOwn(local.hostInputHashes, workspaceManifest), false);
    assert.equal(Object.hasOwn(local.hostInputRealpaths, workspaceManifest), false);
  };
