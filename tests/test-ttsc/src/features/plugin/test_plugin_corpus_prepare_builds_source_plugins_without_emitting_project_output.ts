import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: prepare builds source plugins without emitting
 * project output.
 *
 * The `ttsc prepare` subcommand is designed for CI warm-up: it compiles all
 * source plugins and populates the cache but must not touch TypeScript source
 * files or write JS output. A subsequent `ttsc --emit` should then skip the
 * build step entirely.
 *
 * 1. Copy the `go-source-plugin` fixture and run `ttsc prepare`.
 * 2. Assert zero exit, the `ttsc: prepared` stdout line, the build log in stderr,
 *    no `dist/` directory, and exactly one binary under the plugin cache.
 * 3. Run `ttsc --emit` against the same cache and assert it skips the build
 *    (`building source plugin` absent) yet produces correct JS output.
 */
export const test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output =
  () => {
    const root = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-prepare-");
    const env = {
      PATH: goPath(),
      TTSC_CACHE_DIR: cacheDir,
    };

    const prepared = spawn(ttscBin, ["prepare", "--cwd", root], {
      cwd: root,
      env,
    });
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.match(prepared.stdout, /ttsc: prepared /);
    assert.match(prepared.stderr, /building source plugin "go-source-plugin"/);
    assert.equal(fs.existsSync(path.join(root, "dist")), false);
    const pluginCache = path.join(cacheDir, "plugins");
    const binaries = fs
      .readdirSync(pluginCache, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) =>
        path.join(
          pluginCache,
          entry.name,
          process.platform === "win32" ? "plugin.exe" : "plugin",
        ),
      );
    assert.equal(binaries.length, 1);
    const binary = binaries[0];
    assert.ok(binary);
    assert.equal(fs.existsSync(binary), true);

    const built = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root, env });
    assert.equal(built.status, 0, built.stderr);
    assert.doesNotMatch(built.stderr, /building source plugin/);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
  };
