import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  child_process,
  fs,
  path,
} from "../../../../internal/ttsc/internal/source-build";

/**
 * Verifies a plugin whose `go.mod` replaces a module with a directory outside
 * the module builds that directory as `go build` in the module does, and
 * rebuilds when it changes.
 *
 * The build runs in a scratch copy of the module, so a relative `replace`
 * target such as `../dep` named a sibling of the copy and the build failed,
 * while `go build` in the module compiled it. An absolute target did build, in
 * place, but the cache key never read it, so an edit to it kept serving the
 * first binary (samchon/ttsc#1506). The copy's `go.mod` now names the target
 * from the module, and the key digests every target outside the module.
 *
 * 1. For a relative and an absolute spelling, write a plugin module that prints a
 *    constant of a module it replaces with a sibling directory.
 * 2. Build it with the real Go toolchain and run the binary.
 * 3. Change the constant, build again, and run the binary.
 * 4. Assert the first run printed the first value, the second run the second, and
 *    the two builds are different cache entries.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin and the real Go tool produce first then second output after an external replacement module edit, using distinct binary paths.
 * @evidence contracts/testing.md#independent-expectations Handwritten dependency constants establish first and second output, independent of the builder key computation.
 * @evidence contracts/testing.md#distinguishing-cases Both relative ../dep and absolute external replacements build and invalidate; each spelling retains initial and edited execution.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this exported source-plugin entry in the generic E2E population. Its writeValue/build/run callbacks execute beneath the named owner, using the real built source builder and owned observed spawnSync primitive; callbacks are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The actual builder assembles external replacement inputs and invokes real Go, then the returned artifact executes against literal first/second expectations. Source parsing alone cannot establish that production assembly/native build connection; no Go-version rejection or independent direct-go-build baseline is asserted here.
 * @evidence contracts/e2e.md#shared-execution Each relative/absolute spelling owns its path graph and cache; within that graph a dependency edit precedes the second actual build. Built workspace libraries and available Go installation may share, without certifying hit/rebuild/process/Program totals from binary paths.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Root/source/cache belong to one tracked graph per spelling. Original synchronous build/run order precedes dependency mutation; actual returned launch error/signal/status are checked before accepting output. Roots are conservatively retained because synchronous return is not arbitrary descendant closure. No ambient environment mutation/restoration is performed by this body.
 * @evidence contracts/e2e.md#preserved-coverage buildSourcePlugin and the real Go tool produce first then second output after an external replacement module edit, using distinct binary paths. These assertions stay in test_buildsourceplugin_builds_a_replace_target_outside_the_module_as_go_build_does with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_builds_a_replace_target_outside_the_module_as_go_build_does =
  () => {
    for (const spelling of ["relative", "absolute"] as const) {
      const root = TestProject.tmpdir(`ttsc-replace-target-${spelling}-`);
      TestProject.retainTemporaryDirectory(root, "external replacement native graph has no descendant join acknowledgement");
      const plugin = path.join(root, "plugin");
      const dep = path.join(root, "dep");
      write(
        path.join(plugin, "go.mod"),
        [
          "module example.com/plugin",
          "",
          "go 1.26",
          "",
          "require example.com/dep v0.0.0",
          "",
          `replace example.com/dep => ${
            spelling === "relative" ? "../dep" : dep.split(path.sep).join("/")
          }`,
          "",
        ].join("\n"),
      );
      write(
        path.join(plugin, "cmd", "plugin", "main.go"),
        'package main\n\nimport "example.com/dep"\n\nfunc main() { println(dep.Value) }\n',
      );
      write(path.join(dep, "go.mod"), "module example.com/dep\n\ngo 1.26\n");
      const writeValue = (value: string): void =>
        write(
          path.join(dep, "dep.go"),
          `package dep\n\nconst Value = ${JSON.stringify(value)}\n`,
        );
      const build = (): string =>
        buildSourcePlugin({
          baseDir: root,
          cacheDir: path.join(root, "cache"),
          overlayDirs: [],
          pluginName: "replace-target",
          quiet: true,
          source: path.join(plugin, "cmd", "plugin"),
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        });
      const run = (binary: string): string => {
        const result = child_process.spawnSync(binary, { encoding: "utf8" });
        assert.equal(result.error, undefined, `${spelling}: artifact launch error`);
        assert.equal(result.signal, null, `${spelling}: artifact terminated by signal`);
        assert.equal(result.status, 0, `${spelling}: artifact exit status`);
        return result.stderr.trim();
      };

      writeValue("first");
      const first = build();
      assert.equal(run(first), "first", `${spelling}: the first build`);
      writeValue("second");
      const second = build();
      assert.notEqual(second, first, `${spelling}: the edit keyed a new build`);
      assert.equal(run(second), "second", `${spelling}: the second build`);
    }
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
