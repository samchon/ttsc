import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  __dirname,
  assert,
  commonJsProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: check plugin output does not suppress TypeScript
 * diagnostics.
 *
 * A check-stage plugin emits its own diagnostic (TS9001) via stderr. Without
 * special handling the host could conflate the plugin's exit status with a
 * clean build and skip merging TypeScript's own TS2322. Both diagnostic streams
 * must surface when either source is non-clean.
 *
 * 1. Write a source file with a genuine TS2322 type error.
 * 2. Register a check-stage Go plugin that always emits a custom TS9001 warning.
 * 3. Run ttsc with `--noEmit`.
 * 4. Assert both TS9001 and TS2322 appear in stderr with a non-zero exit code.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --noEmit reports both the check child warning TS9001 and compiler TS2322 with a failing status.
 * @evidence contracts/testing.md#independent-expectations The Go fixture prints a literal warning and assigning a string to number independently requires TS2322.
 * @evidence contracts/testing.md#distinguishing-cases A successful warning-producing check child coexists with a failing compiler; runtime-failure cases own crashed children.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_check_plugin_output_does_not_suppress_typescript_diagnostics entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary An actually compiled check child writes a warning while the independent TypeScript compiler finds a type error. The CLI must merge both stderr streams and select failure; direct diagnostic merging without those real child invocations cannot establish their delivery.
 * @evidence contracts/e2e.md#shared-execution The suite reuses built workspace packages and the shared content-addressed producer cache when this case selects it. Separate launcher invocations carry this case's differing arguments or selected runtime entry; a case-local cold cache is retained when preparation or failure is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --noEmit reports both the check child warning TS9001 and compiler TS2322 with a failing status. These assertions stay in test_plugin_corpus_check_plugin_output_does_not_suppress_typescript_diagnostics with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_check_plugin_output_does_not_suppress_typescript_diagnostics =
  () => {
    const root = commonJsProject(
      {
        "plugins/check.cjs": `module.exports = (context) => ({
        name: "warning-check",
        source: require("node:path").resolve(context.dirname, "check-go"),
        stage: "check",
      });\n`,
        "plugins/check-go/go.mod":
          "module example.com/warningcheck\n\ngo 1.26\n",
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
          '\t\tfmt.Fprintln(os.Stderr, "src/main.ts(1,1): warning TS9001: check warning")',
          "\t}",
          "}",
          "",
        ].join("\n"),
        "src/main.ts": `const value: number = "type-error";\nconsole.log(value);\n`,
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

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /TS9001: check warning/);
    assert.match(result.stderr, /TS2322/);
  };
