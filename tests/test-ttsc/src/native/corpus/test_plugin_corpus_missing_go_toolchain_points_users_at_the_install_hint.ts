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
 * Verifies plugin corpus: missing Go toolchain points users at the install
 * hint.
 *
 * Source plugins require `go build`, and first-time users often do not have Go
 * in PATH. When neither `go` nor the `TTSC_GO_BINARY` override resolves to a
 * real binary, ttsc must emit a human-readable message (`Go toolchain was not
 * found`) and name the env variable they can set to fix it.
 *
 * 1. Copy the `go-source-plugin` fixture into a temp directory.
 * 2. Run ttsc with a PATH that contains no Go binary and `TTSC_GO_BINARY` pointing
 *    at a nonexistent path.
 * 3. Assert non-zero exit, `Go toolchain was not found`, and `TTSC_GO_BINARY` in
 *    stderr.
 */
export const test_plugin_corpus_missing_go_toolchain_points_users_at_the_install_hint =
  () => {
    const root = copyProject("go-source-plugin");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        // Strip Go binaries from PATH and force lookup of a guaranteed-missing
        // toolchain via TTSC_GO_BINARY.
        PATH: "/nonexistent",
        TTSC_GO_BINARY: "/nonexistent/go-binary-that-does-not-exist",
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-source-plugin-no-go-"),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Go toolchain was not found/);
    assert.match(result.stderr, /TTSC_GO_BINARY/);
  };
