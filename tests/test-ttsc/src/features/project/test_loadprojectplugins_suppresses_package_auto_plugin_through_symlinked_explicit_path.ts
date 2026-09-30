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
 *
 * @evidence contracts/testing.md#behavioral-verification A package explicitly selected through its linked path is loaded exactly once despite also declaring auto-discovery metadata.
 * @evidence contracts/testing.md#independent-expectations The authored explicit descriptor and manifest name the same physical package, so a single loaded plugin is the independent deduplication expectation.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create a fake package at `packages/linked-plugin` that carries `ttsc.plugin` metadata, then symlink it into `project/node_modules/`. 2. Write a tsconfig that references the package via the symlinked relative path `./node_modules/linked-plugin/index.cjs`. 3. Invoke `loadProjectPlugins` and assert exactly one native plugin is loaded.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage A package explicitly selected through its linked path is loaded exactly once despite also declaring auto-discovery metadata. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
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
