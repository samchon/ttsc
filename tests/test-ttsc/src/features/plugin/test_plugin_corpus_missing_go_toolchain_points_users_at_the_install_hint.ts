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
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
        TTSC_CACHE_DIR: fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-source-plugin-no-go-"),
        ),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Go toolchain was not found/);
    assert.match(result.stderr, /TTSC_GO_BINARY/);
  };
