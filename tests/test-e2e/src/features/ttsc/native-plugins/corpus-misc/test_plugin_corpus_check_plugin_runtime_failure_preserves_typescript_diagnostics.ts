import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  goPath,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: check plugin runtime failure preserves TypeScript
 * diagnostics.
 *
 * A check-stage sidecar can fail before it has loaded the project Program. The
 * host must keep the sidecar's failure output and status while still running an
 * independent no-emit TypeScript check, otherwise an internal plugin bug hides
 * unrelated errors in the user's source code.
 *
 * 1. Write a source file with two genuine TS2322 type errors.
 * 2. Register a check-stage Go plugin that reports one error, then exits 3.
 * 3. Run ttsc with `--noEmit`.
 * 4. Assert the failure/status survive and both TS errors occur exactly once.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --noEmit retains exit 3 and the crash message while reporting exactly two TS2322 occurrences.
 * @evidence contracts/testing.md#independent-expectations The child explicitly exits 3 and reports one of two incompatible assignments; the second assignment requires independent compiler checking.
 * @evidence contracts/testing.md#distinguishing-cases Partial diagnostics before a check crash must neither hide the second error nor duplicate the first; the transform crash case owns the other stage.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_check_plugin_runtime_failure_preserves_typescript_diagnostics entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The compiled check child emits one compiler-shaped error and crashes with status 3. The launcher must run fallback checking, deduplicate that first error, preserve the second error and retain the child status; this exercises actual sidecar failure transport.
 * @evidence contracts/e2e.md#shared-execution The suite reuses built workspace packages and the shared content-addressed producer cache when this case selects it. Separate launcher invocations carry this case's differing arguments or selected runtime entry; a case-local cold cache is retained when preparation or failure is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --noEmit retains exit 3 and the crash message while reporting exactly two TS2322 occurrences. These assertions stay in test_plugin_corpus_check_plugin_runtime_failure_preserves_typescript_diagnostics with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_check_plugin_runtime_failure_preserves_typescript_diagnostics =
  () => {
    const root = commonJsProject(
      {
        "plugins/check.cjs": `module.exports = (context) => ({
        name: "failing-check",
        source: require("node:path").resolve(context.dirname, "check-go"),
        stage: "check",
      });\n`,
        "plugins/check-go/go.mod":
          "module example.com/failingcheck\n\ngo 1.26\n",
        "plugins/check-go/main.go": [
          "package main",
          "",
          "import (",
          '\t"fmt"',
          '\t"os"',
          ")",
          "",
          "func main() {",
          '\tif len(os.Args) > 1 && os.Args[1] == "check" {',
          "\t\tfmt.Fprintln(os.Stderr, \"src/main.ts:1:7 - error TS2322: Type 'string' is not assignable to type 'number'.\")",
          '\t\tfmt.Fprintln(os.Stderr, "check plugin crashed")',
          "\t\tos.Exit(3)",
          "\t}",
          "}",
          "",
        ].join("\n"),
        "src/main.ts": [
          `const first: number = "first-error";`,
          `const second: number = "second-error";`,
          "console.log(first, second);",
          "",
        ].join("\n"),
      },
      {
        compilerOptions: {
          plugins: [{ transform: "./plugins/check.cjs" }],
        },
      },
    );
    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });

    assert.equal(result.status, 3);
    assert.match(result.stderr, /check plugin crashed/);
    assert.equal(result.stderr.match(/TS2322/g)?.length, 2, result.stderr);
  };
