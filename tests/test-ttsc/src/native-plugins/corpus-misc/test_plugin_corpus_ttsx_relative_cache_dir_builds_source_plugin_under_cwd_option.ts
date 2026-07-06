import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttsxBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx relative cache dir builds source plugin under
 * cwd option.
 *
 * `ttsx` accepts the same `--cwd` and `--cache-dir` flags as `ttsc`, and a
 * relative `--cache-dir` must anchor to `--cwd`, not the process working
 * directory. This mirrors the `ttsc` behaviour tested in
 * `test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option` but
 * validates the ttsx code path separately since ttsx has its own argument
 * parsing.
 *
 * 1. Copy `go-source-plugin` and create a separate `driverCwd`.
 * 2. Run ttsx from `driverCwd` with `--cwd <root> --cache-dir .ttsx-cache`.
 * 3. Assert zero exit, stdout `"PLUGIN"`, plugin cache under
 *    `<root>/.ttsx-cache/`, cleaned project output, and no cache under
 *    `<driverCwd>/.ttsx-cache/`.
 */
export const test_plugin_corpus_ttsx_relative_cache_dir_builds_source_plugin_under_cwd_option =
  () => {
    const root = copyProject("go-source-plugin");
    const driverCwd = TestProject.tmpdir("ttsx-driver-");
    const cacheDir = ".ttsx-cache";

    const result = spawn(
      ttsxBin,
      ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
      {
        cwd: driverCwd,
        env: { PATH: goPath() },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "PLUGIN");
    const projectCache = path.join(root, cacheDir, "project");
    assert.equal(fs.existsSync(projectCache), true);
    assert.deepEqual(fs.readdirSync(projectCache), []);
    assert.equal(fs.existsSync(path.join(root, cacheDir, "plugins")), true);
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "project")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "plugins")),
      false,
    );
  };
