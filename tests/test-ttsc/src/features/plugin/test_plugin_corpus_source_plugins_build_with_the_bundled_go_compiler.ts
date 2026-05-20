import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  os,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugins build with the bundled Go compiler.
 *
 * Ttsc ships a platform-specific Go SDK inside its own package so users do not
 * need to install Go separately. This test proves that even with `PATH`
 * pointing at a nonexistent directory — so no system `go` binary is available —
 * the bundled SDK compiles the plugin successfully.
 *
 * 1. Copy the `go-source-plugin` fixture.
 * 2. Run ttsc with `PATH=/nonexistent` (no system Go toolchain accessible).
 * 3. Assert zero exit and `"PLUGIN"` in the emitted JS.
 */
export const test_plugin_corpus_source_plugins_build_with_the_bundled_go_compiler =
  () => {
    const root = copyProject("go-source-plugin");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: "/nonexistent",
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-source-plugin-bundled-go-"),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
  };
