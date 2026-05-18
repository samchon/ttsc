import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  loadProjectPlugins,
  os,
  path,
} from "../../internal/project";

/**
 * Verifies loadProjectPlugins suppresses package auto plugin through symlinked
 * explicit path.
 *
 * This ttsc project config scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_loadprojectplugins_suppresses_package_auto_plugin_through_symlinked_explicit_path =
  () => {
    const root = TestProject.tmpdir("ttsc-project-");
    const realPackage = path.join(root, "packages", "linked-plugin");
    const project = path.join(root, "project");
    const linkedPackage = path.join(project, "node_modules", "linked-plugin");
    fs.mkdirSync(path.dirname(linkedPackage), { recursive: true });
    fs.mkdirSync(path.join(realPackage, "plugin-go"), { recursive: true });
    fs.mkdirSync(project, { recursive: true });
    fs.symlinkSync(realPackage, linkedPackage, "junction");
    fs.writeFileSync(
      path.join(project, "package.json"),
      JSON.stringify({
        private: true,
        devDependencies: {
          "linked-plugin": "0.0.0",
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          plugins: [{ transform: "./node_modules/linked-plugin/index.cjs" }],
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(realPackage, "package.json"),
      JSON.stringify({
        main: "index.cjs",
        name: "linked-plugin",
        ttsc: {
          plugin: {
            transform: "linked-plugin",
          },
        },
        version: "0.0.0",
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(realPackage, "index.cjs"),
      `module.exports = {
      name: "linked-plugin",
      source: ${JSON.stringify(path.join(realPackage, "plugin-go"))}
    };\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(realPackage, "plugin-go", "go.mod"),
      "module example.com/linkedplugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(realPackage, "plugin-go", "main.go"),
      "package main\n\nfunc main() {}\n",
      "utf8",
    );

    const loaded = loadProjectPlugins({
      binary: "",
      cacheDir: path.join(root, "cache"),
      cwd: project,
      tsconfig: path.join(project, "tsconfig.json"),
    });

    assert.equal(loaded.nativePlugins.length, 1);
  };
