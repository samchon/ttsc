import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  child_process,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies a source plugin builds when its modules declare a patch Go release.
 *
 * The builder wrote a fixed `go 1.26` into the scratch `go.work`. Go treats a
 * module's `go 1.26.0` as newer than that workspace directive and refused the
 * build before compiling anything. The Go tool now sets the directive from the
 * modules it lists, so a patch-qualified module builds, and a module the
 * selected toolchain is too old for still fails with Go's own version error.
 *
 * 1. Write a plugin module and an overlay module that both declare `go 1.26.0`.
 * 2. Build the plugin and run its binary.
 * 3. Raise the overlay's directive past any installed toolchain and build again
 *    with `GOTOOLCHAIN=local`.
 * 4. Assert the first build printed the overlay's value and the second failed
 *    naming the required Go version.
 */
export const test_buildsourceplugin_builds_modules_that_declare_a_patch_go_release =
  () => {
    const root = TestProject.tmpdir("ttsc-patch-go-release-");
    const plugin = path.join(root, "plugin");
    const overlay = path.join(root, "overlay");
    write(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26.0\n\nrequire example.com/overlay v0.0.0\n",
    );
    write(
      path.join(plugin, "cmd", "plugin", "main.go"),
      'package main\n\nimport "example.com/overlay"\n\nfunc main() { println(overlay.Value) }\n',
    );
    write(path.join(overlay, "go.mod"), "module example.com/overlay\n\ngo 1.26.0\n");
    write(
      path.join(overlay, "overlay.go"),
      'package overlay\n\nconst Value = "patch-release"\n',
    );
    const build = (env?: NodeJS.ProcessEnv): string =>
      buildSourcePlugin({
        baseDir: root,
        cacheDir: path.join(root, "cache"),
        env,
        overlayDirs: [overlay],
        pluginName: "patch-release",
        quiet: true,
        source: path.join(plugin, "cmd", "plugin"),
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

    const binary = build();
    assert.equal(
      child_process.spawnSync(binary, { encoding: "utf8" }).stderr.trim(),
      "patch-release",
    );

    write(path.join(overlay, "go.mod"), "module example.com/overlay\n\ngo 1.99.0\n");
    assert.throws(
      () => build({ ...process.env, GOTOOLCHAIN: "local" }),
      /go >= 1\.99\.0/,
    );
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
