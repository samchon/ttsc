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
 * A package that ships `ttsc.plugin` metadata would normally be auto-discovered
 * and added to the plugin list. But when the user has already listed the same
 * package explicitly via a relative `transform` path (even through a symlink),
 * the auto-discovery must not add a second copy, to avoid running the plugin
 * twice.
 *
 * 1. Create a fake package at `packages/linked-plugin` that carries `ttsc.plugin`
 *    metadata, then symlink it into `project/node_modules/`.
 * 2. Write a tsconfig that references the package via the symlinked relative path
 *    `./node_modules/linked-plugin/index.cjs`.
 * 3. Invoke `loadProjectPlugins` and assert exactly one native plugin is loaded.
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
