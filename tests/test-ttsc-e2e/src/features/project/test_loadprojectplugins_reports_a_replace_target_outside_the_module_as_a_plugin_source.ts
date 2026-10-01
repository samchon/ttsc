import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a plugin load reports a directory outside the plugin's Go module
 * that its `go.mod` replaces a module with, both as a watch input and among
 * `pluginSources`.
 *
 * `go build` compiles such a directory in place, so it is as much a source of
 * the plugin's binary as the module itself. The load reported only the module,
 * its contributors, and its linked packages, so neither `ttsc --watch` nor a
 * consumer proving `pluginSources` (`@ttsc/unplugin`, the capability cache)
 * ever saw it change (samchon/ttsc#1506).
 *
 * 1. Load a project whose executable plugin's `go.mod` replaces a module with an
 *    absolute sibling directory, and assert the watch inputs and the load's
 *    `pluginSources` both name the module root and that directory.
 * 2. Load one whose `go.mod` spells the target relatively, and assert the watch
 *    inputs name the target.
 *
 * @evidence contracts/testing.md#behavioral-verification Absolute and relative external replace targets remain watch inputs, and the absolute target is included in pluginSources.
 * @evidence contracts/testing.md#independent-expectations The authored go.mod replaces an external sibling, so both the original module and that sibling are actual binary inputs.
 * @evidence contracts/testing.md#distinguishing-cases 1. Load a project whose executable plugin's `go.mod` replaces a module with an absolute sibling directory, and assert the watch inputs and the load's `pluginSources` both name the module root and that directory. 2. Load one whose `go.mod` spells the target relatively, and assert the watch inputs name the target.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Absolute and relative external replace targets remain watch inputs, and the absolute target is included in pluginSources. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_loadprojectplugins_reports_a_replace_target_outside_the_module_as_a_plugin_source =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-replace-target-");
    const project = path.join(root, "project");
    const module = path.join(root, "plugin-module");
    const dep = path.join(root, "dep");
    const writeModule = (target: string): void =>
      write(
        path.join(module, "go.mod"),
        [
          "module example.com/plugin",
          "",
          "go 1.26",
          "",
          "require example.com/dep v0.0.0",
          "",
          `replace example.com/dep => ${target}`,
          "",
        ].join("\n"),
      );
    writeModule(dep.split(path.sep).join("/"));
    write(path.join(module, "cmd", "plugin", "main.go"), "package main\n");
    // The files the fake Go build requires of the module it compiles.
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      write(path.join(module, relative), "package generated\n");
    }
    write(path.join(dep, "go.mod"), "module example.com/dep\n\ngo 1.26\n");
    write(path.join(dep, "dep.go"), "package dep\n");
    write(
      path.join(project, "executable.cjs"),
      `module.exports = () => (${JSON.stringify({
        name: "executable",
        source: path.join(module, "cmd", "plugin"),
      })});\n`,
    );
    write(
      path.join(project, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { plugins: [{ transform: "./executable.cjs" }] },
      }),
    );
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const expected = [
      fs.realpathSync.native(dep),
      fs.realpathSync(module),
    ].sort();
    const load = (
      cache: string,
      reported: (inputs: readonly string[]) => void,
    ) =>
      loadProjectPlugins({
        binary: "",
        cacheDir: path.join(root, cache),
        cwd: project,
        env: {
          ...process.env,
          TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
          TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
        },
        onWatchInputs: reported,
        tsconfig: path.join(project, "tsconfig.json"),
      });

    // 1. An absolute target, built in place.
    let inputs: readonly string[] | undefined;
    const loaded = load("cache", (reported) => {
      inputs = reported;
    });
    assert.deepEqual(inputs, expected, "the watch inputs");
    assert.deepEqual(
      Object.keys(loaded.pluginSources).sort(),
      expected,
      "the reported plugin sources",
    );

    // 2. A relative target: the inputs are reported before the build anchors it.
    writeModule("../dep");
    let relative: readonly string[] | undefined;
    load("relative-cache", (reported) => {
      relative = reported;
    });
    assert.deepEqual(
      relative,
      expected,
      "the watch inputs of a relative target",
    );
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
