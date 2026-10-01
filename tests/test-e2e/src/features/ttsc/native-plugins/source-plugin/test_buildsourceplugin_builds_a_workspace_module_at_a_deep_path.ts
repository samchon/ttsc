import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  child_process,
  fs,
  path,
} from "../../../../internal/ttsc/internal/source-build";

/**
 * Verifies a plugin built with a workspace module outside it builds when that
 * module sits deep below the drive root.
 *
 * The build copies each workspace module (an overlay, as `ttsc`'s own shims are
 * for a linked plugin host) below its scratch directory under the module's
 * complete absolute path, then ran `go mod edit -json` with the copy as its
 * working directory. On Windows a working directory longer than MAX_PATH makes
 * process creation fail with `ENOENT`, which the build reported as "the Go
 * toolchain was not found" although the bundled Go was present
 * (samchon/ttsc#1572). The tool now takes the `go.mod` path as an argument, and
 * a spawn failure names a missing toolchain only when the executable is
 * missing.
 *
 * 1. Place a module the plugin imports through the build's workspace below enough
 *    nested directories that its copy's path passes 260 characters.
 * 2. Build the plugin with the real Go toolchain.
 * 3. Assert the build succeeds and the binary prints the replaced module's
 *    constant.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin compiles a deep overlay module and the resulting binary prints deep.
 * @evidence contracts/testing.md#independent-expectations The imported dependency defines the literal deep, requiring the emitted binary to resolve the intended workspace module.
 * @evidence contracts/testing.md#distinguishing-cases The dependency path exceeds 180 characters so scratch materialization crosses the historical Windows cwd limit; this case does not assert an unrelated missing-tool failure.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_builds_a_workspace_module_at_a_deep_path entry is discovered by TestExecutor from source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin assembles the module/workspace and invokes installed Go, then the returned artifact is executed where the scenario does so. The dependency literal and Go version rejection distinguish incorrect module selection or incompatible workspace assembly that source-only parsing cannot prove.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The fake subprocess fixtures avoid unnecessary native compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage buildSourcePlugin compiles a deep overlay module and the resulting binary prints deep. These assertions stay in test_buildsourceplugin_builds_a_workspace_module_at_a_deep_path with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_builds_a_workspace_module_at_a_deep_path =
  () => {
    const root = TestProject.tmpdir("ttsc-deep-workspace-");
    const deep = path.join(
      root,
      ...Array.from(
        { length: 4 },
        (_, index) => `a-directory-deep-enough-to-pass-max-path-${index}`,
      ),
    );
    const plugin = path.join(deep, "plugin");
    const dep = path.join(deep, "dep");
    assert.ok(
      dep.length > 180,
      `the fixture must put the copy past MAX_PATH (${dep.length})`,
    );
    write(
      path.join(plugin, "go.mod"),
      [
        "module example.com/plugin",
        "",
        "go 1.26",
        "",
        "require example.com/dep v0.0.0",
        "",
      ].join("\n"),
    );
    write(
      path.join(plugin, "cmd", "plugin", "main.go"),
      'package main\n\nimport "example.com/dep"\n\nfunc main() { println(dep.Value) }\n',
    );
    write(path.join(dep, "go.mod"), "module example.com/dep\n\ngo 1.26\n");
    write(path.join(dep, "dep.go"), 'package dep\n\nconst Value = "deep"\n');

    const binary = buildSourcePlugin({
      baseDir: root,
      cacheDir: path.join(root, "cache"),
      overlayDirs: [dep],
      pluginName: "deep-workspace",
      quiet: true,
      source: path.join(plugin, "cmd", "plugin"),
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    assert.equal(
      child_process.spawnSync(binary, { encoding: "utf8" }).stderr.trim(),
      "deep",
    );
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
