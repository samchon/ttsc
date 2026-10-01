import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  os,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: missing Go toolchain points users at the install
 * hint.
 *
 * Source plugins require `go build`, and first-time users often do not have Go
 * in PATH. When neither `go` nor the `TTSC_GO_BINARY` override resolves to a
 * real binary, including a missing named Windows `.cmd` wrapper rejected before
 * selecting `cmd.exe`, ttsc must emit a human-readable message (`Go toolchain
 * was not found`) and name the env variable they can set to fix it.
 *
 * 1. Copy the `go-source-plugin` fixture into a temp directory.
 * 2. Run ttsc with a PATH that contains no Go binary and `TTSC_GO_BINARY` pointing
 *    at a nonexistent path.
 * 3. Assert non-zero exit, `Go toolchain was not found`, and `TTSC_GO_BINARY` in
 *    stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --emit with an absent selected Go tool fails and names both the install hint and TTSC_GO_BINARY.
 * @evidence contracts/testing.md#independent-expectations The executable override is deliberately nonexistent and PATH cannot resolve a usable Go tool.
 * @evidence contracts/testing.md#distinguishing-cases Missing native name on POSIX and missing cmd wrapper on Windows exercise the install hint; successful source builds own the positive control.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_missing_go_toolchain_points_users_at_the_install_hint entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The CLI reaches actual missing executable selection from the source-plugin descriptor and converts that native error into an install hint. A direct formatter cannot prove this error survives tool selection and launcher reporting; the plugin cache is private and cold so no warm binary bypasses the failure.
 * @evidence contracts/e2e.md#shared-execution The suite reuses built workspace packages and the shared content-addressed producer cache when this case selects it. Separate launcher invocations carry this case's differing arguments or selected runtime entry; a case-local cold cache is retained when preparation or failure is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --emit with an absent selected Go tool fails and names both the install hint and TTSC_GO_BINARY. These assertions stay in test_plugin_corpus_missing_go_toolchain_points_users_at_the_install_hint with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
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
        TTSC_GO_BINARY:
          process.platform === "win32" ? "missing-go.cmd" : "missing-go",
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-source-plugin-no-go-"),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Go toolchain was not found/);
    assert.match(result.stderr, /TTSC_GO_BINARY/);
  };
