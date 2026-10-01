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
 *
 * @evidence contracts/testing.md#behavioral-verification Watch inputs and pluginSources report the replaced linked directory by physical path rather than a duplicate lexical alias.
 * @evidence contracts/testing.md#independent-expectations The fixture realpath and authored Go replace target independently establish the external module directory.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create a plugin module and a replaced module, and a link to the replaced one. 2. Point the module's `replace` directive at the target through the link. 3. Assert the load reports the target's physical directory.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The isolated descriptor evaluator must carry real module selection, loaded values and input proof back to loadProjectPlugins; direct calls to path or fingerprint helpers cannot establish evaluator transport or module-cache isolation.
 * @evidence contracts/e2e.md#shared-execution All loads in this named case reuse its private fixture and cache. Descriptor reevaluation is retained only for a distinct format, changed input/proof state or intentionally nonreusable factory; an unchanged proven evaluation uses the same cache. Fake Go fixtures avoid rebuilding a real plugin where this case already supplies them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The TestProject-owned root separates module selection and descriptor records from other cases. Authored edits and aged records remain within that root; synchronous evaluator/build children finish before assertions, and TestProject registers temporary roots for process-exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Watch inputs and pluginSources report the replaced linked directory by physical path rather than a duplicate lexical alias. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
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
    const expected = [
      fs.realpathSync.native(dep),
      fs.realpathSync(module),
    ].sort();
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
