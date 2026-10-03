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
 * 1. Place the imported workspace module under four long components and assert
 *    the authored dependency path exceeds 180 characters.
 * 2. Build the plugin with the real Go toolchain.
 * 3. Assert the build succeeds and the binary prints the replaced module's
 *    constant.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin compiles a deep overlay module and the resulting binary prints deep.
 * @evidence contracts/testing.md#independent-expectations The imported dependency defines the literal deep, requiring the emitted binary to resolve the intended workspace module.
 * @evidence contracts/testing.md#distinguishing-cases The actual dependency path exceeds 180 characters with four long components. No captured scratch cwd-over-260, missing-tool negative or Windows-only selection is asserted.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named generic source-plugin entry, executing the actual built source builder and observed artifact spawnSync; the directory component callback is not a separately selectable host.
 * @evidence contracts/e2e.md#necessary-boundary Actual workspace assembly and real Go compilation must resolve the deep imported module, then its produced binary prints the authored dependency. Direct path/module parsing cannot establish that connection; this case has no fake compiler or Go-version rejection.
 * @evidence contracts/e2e.md#shared-execution One deep source graph/private cache supplies this actual native build and artifact execution. Workspace libraries and available Go may share; no cold/hit/no-rebuild/process/Program total is inferred from that availability.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root contains source/overlay/cache. Actual returned artifact launch error/signal/status must pass before stderr is accepted; root is retained because synchronous return is not arbitrary descendant closure. This body does not mutate ambient environment or restore it in a finally block.
 * @evidence contracts/e2e.md#preserved-coverage buildSourcePlugin compiles a deep overlay module and the resulting binary prints deep. These assertions stay in test_buildsourceplugin_builds_a_workspace_module_at_a_deep_path with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_builds_a_workspace_module_at_a_deep_path =
  () => {
    const root = TestProject.tmpdir("ttsc-deep-workspace-");
    TestProject.retainTemporaryDirectory(root, "deep native workspace has no descendant join acknowledgement");
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
    const result = child_process.spawnSync(binary, { encoding: "utf8" });
    assert.equal(result.error, undefined, "deep artifact launch error");
    assert.equal(result.signal, null, "deep artifact terminated by signal");
    assert.equal(result.status, 0, "deep artifact exit status");
    assert.equal(
      result.stderr.trim(),
      "deep",
    );
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
