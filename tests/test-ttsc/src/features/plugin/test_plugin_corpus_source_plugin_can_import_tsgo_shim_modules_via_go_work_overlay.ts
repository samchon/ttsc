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
 * Verifies plugin corpus: source plugin can import tsgo shim modules via
 * go.work overlay.
 *
 * Plugins that use TypeScript-Go's checker or printer shims import them as Go
 * module paths (e.g. `github.com/microsoft/typescript-go/shim/printer`). ttsc
 * injects a `go.work` overlay pointing these imports at the bundled shim copies
 * so plugins can reference stable shim APIs without vendoring the entire tsgo
 * repo in their `go.sum`.
 *
 * 1. Copy the `go-source-plugin-tsgo` fixture whose Go source imports a tsgo shim
 *    module.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit, a build log entry, and `"TSGO (tsgo)"` in the emitted JS,
 *    proving the shim import resolved correctly.
 */
export const test_plugin_corpus_source_plugin_can_import_tsgo_shim_modules_via_go_work_overlay =
  () => {
    const root = copyProject("go-source-plugin-tsgo");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-tsgo-");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: cacheDir,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /building source plugin "go-source-plugin-tsgo"/,
    );
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"TSGO \(tsgo\)"/,
    );
  };
