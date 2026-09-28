import { TestProject } from "@ttsc/testing";

import { assert, fs, loadProjectPlugins, path } from "../../internal/project";
import { createFakeGoBinary } from "../../internal/source-build";

/**
 * Verifies a plugin module's `replace` target spelled through a link is
 * reported by the directory it names, as the module itself is.
 *
 * Every plugin source a load reports is a physical directory, so a consumer can
 * compare them. An absolute `replace` target kept the spelling `go.mod` gave
 * it, so a target reached through a link was reported, keyed, and watched under
 * a second name beside the module's physical one, and a target inside the
 * module spelled through a link counted as outside it. macOS spells every
 * temporary directory that way, through `/var`.
 *
 * 1. Create a plugin module and a replaced module, and a link to the replaced one.
 * 2. Point the module's `replace` directive at the target through the link.
 * 3. Assert the load reports the target's physical directory.
 */
export const test_loadprojectplugins_reports_a_linked_replace_target_by_its_physical_path =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-linked-replace-");
    const project = path.join(root, "project");
    const module = path.join(root, "plugin-module");
    const dep = path.join(root, "dep");
    const linkedDep = path.join(root, "linked-dep");
    write(path.join(dep, "go.mod"), "module example.com/dep\n\ngo 1.26\n");
    write(path.join(dep, "dep.go"), "package dep\n");
    fs.symlinkSync(dep, linkedDep, "junction");
    write(
      path.join(module, "go.mod"),
      [
        "module example.com/plugin",
        "",
        "go 1.26",
        "",
        "require example.com/dep v0.0.0",
        "",
        `replace example.com/dep => ${linkedDep.split(path.sep).join("/")}`,
        "",
      ].join("\n"),
    );
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

    let inputs: readonly string[] | undefined;
    const loaded = loadProjectPlugins({
      binary: "",
      cacheDir: path.join(root, "cache"),
      cwd: project,
      env: {
        ...process.env,
        TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
        TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
      },
      onWatchInputs: (reported) => {
        inputs = reported;
      },
      tsconfig: path.join(project, "tsconfig.json"),
    });
    const expected = [fs.realpathSync.native(dep), fs.realpathSync(module)].sort();
    assert.deepEqual(inputs, expected, "the watch inputs");
    assert.deepEqual(
      Object.keys(loaded.pluginSources).sort(),
      expected,
      "the reported plugin sources",
    );
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
