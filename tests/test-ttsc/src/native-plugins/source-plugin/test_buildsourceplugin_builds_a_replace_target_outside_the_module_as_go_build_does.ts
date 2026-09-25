import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  child_process,
  fs,
  path,
} from "../../internal/source-build";

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
 */
export const test_buildsourceplugin_builds_a_replace_target_outside_the_module_as_go_build_does =
  () => {
    for (const spelling of ["relative", "absolute"] as const) {
      const root = TestProject.tmpdir(`ttsc-replace-target-${spelling}-`);
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
      const run = (binary: string): string =>
        child_process.spawnSync(binary, { encoding: "utf8" }).stderr.trim();

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
