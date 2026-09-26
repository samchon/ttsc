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
    const expected = [fs.realpathSync(dep), fs.realpathSync(module)].sort();
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
