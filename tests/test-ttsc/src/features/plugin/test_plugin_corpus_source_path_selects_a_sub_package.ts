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
 * Verifies plugin corpus: source path selects a sub-package.
 *
 * A plugin's entry point may live in a sub-package of the module (e.g.
 * `cmd/ttsc-go-transformer`). The build system must pass the sub-package path
 * to `go build` so the correct `main` is compiled; pointing at the module root
 * would build the wrong binary or fail if no root `main` exists.
 *
 * 1. Copy the `go-source-plugin-entry` fixture whose plugin points at a
 *    sub-package entry directory.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit, a build log referencing the plugin name, and `"ENTRY"` in
 *    the emitted JS (verifying the sub-package's `main` ran).
 */
export const test_plugin_corpus_source_path_selects_a_sub_package = () => {
  const root = copyProject("go-source-plugin-entry");
  const cacheDir = TestProject.tmpdir("ttsc-source-plugin-entry-");
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stderr,
    /building source plugin "go-source-plugin-entry"/,
  );
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /"ENTRY"/,
  );
};
