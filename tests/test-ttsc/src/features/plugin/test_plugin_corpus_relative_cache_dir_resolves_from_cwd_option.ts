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
 * Verifies plugin corpus: relative cache dir resolves from cwd option.
 *
 * When `--cache-dir` is a relative path it must be anchored at `--cwd` (the
 * TypeScript project root), not at the process working directory from which
 * ttsc was launched. Build tools and monorepo scripts commonly differ in their
 * working directories, so anchoring at `--cwd` keeps the cache co-located with
 * the project regardless of how the process is invoked.
 *
 * 1. Copy the `go-source-plugin` fixture and create a separate `driverCwd` dir.
 * 2. Run ttsc with `--cwd <root> --cache-dir relative-cache` from `driverCwd`.
 * 3. Assert zero exit, the cache appears under `<root>/relative-cache/plugins`,
 *    and does NOT appear under `<driverCwd>/relative-cache/plugins`.
 */
export const test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option =
  () => {
    const root = copyProject("go-source-plugin");
    const driverCwd = TestProject.tmpdir("ttsc-driver-");
    const cacheDir = "relative-cache";

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--cache-dir", cacheDir],
      {
        cwd: driverCwd,
        env: { PATH: goPath() },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /building source plugin "go-source-plugin"/);
    assert.equal(fs.existsSync(path.join(root, cacheDir, "plugins")), true);
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "plugins")),
      false,
    );
  };
