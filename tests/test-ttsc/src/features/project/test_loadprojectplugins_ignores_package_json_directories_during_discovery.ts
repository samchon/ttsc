import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";

/**
 * Verifies package auto-discovery treats only regular manifests as boundaries.
 *
 * Node ignores a directory named `package.json` and continues to the nearest
 * ancestor file. The loader must make the same selection and retain the nearer
 * directory candidate, because replacing it with a file changes discovery.
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
