import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  goPath,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: transform plugin runtime failure preserves TypeScript
 * diagnostics.
 *
 * A transform-stage sidecar owns the compiler process and can terminate before
 * its normal Program diagnostics run. ttsc must retain that runtime failure but
 * perform an independent no-emit check so the broken plugin cannot conceal
 * errors in the project it was asked to compile.
 *
 * 1. Write a source file with a genuine TS2322 type error.
 * 2. Register a transform-stage Go plugin that exits 3 from every command.
 * 3. Run both normal emitting and explicit no-emit ttsc builds.
 * 4. Assert the plugin failure, original status, and TS2322 always surface.
 *
 * @evidence contracts/testing.md#behavioral-verification Normal emit and explicit no-emit invocations retain transform exit 3, crash output, and TS2322.
 * @evidence contracts/testing.md#independent-expectations The Go fixture exits 3 and the string-to-number source requires a compiler error independently.
 * @evidence contracts/testing.md#distinguishing-cases Both emitting and no-emit lanes cover a transform crash; the check crash case retains deduplicated check-stage diagnostics.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_transform_plugin_runtime_failure_preserves_typescript_diagnostics entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The compiled transform host crashes before ordinary diagnostics. Both emitting and no-emit launcher routes must retain its status/message and run independent TypeScript checking, which portable rule calls do not exercise.
 * @evidence contracts/e2e.md#shared-execution The suite reuses built workspace packages and the shared content-addressed producer cache when this case selects it. Separate launcher invocations carry this case's differing arguments or selected runtime entry; a case-local cold cache is retained when preparation or failure is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage Normal emit and explicit no-emit invocations retain transform exit 3, crash output, and TS2322. These assertions stay in test_plugin_corpus_transform_plugin_runtime_failure_preserves_typescript_diagnostics with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_transform_plugin_runtime_failure_preserves_typescript_diagnostics =
  () => {
    const root = commonJsProject(
      {
        "plugins/transform.cjs": `module.exports = (context) => ({
        name: "failing-transform",
        source: require("node:path").resolve(context.dirname, "transform-go"),
      });\n`,
        "plugins/transform-go/go.mod":
          "module example.com/failingtransform\n\ngo 1.26\n",
        "plugins/transform-go/main.go": [
          "package main",
          "",
          "import (",
          '\t"fmt"',
          '\t"os"',
          ")",
          "",
          "func main() {",
          '\tfmt.Fprintln(os.Stderr, "transform plugin crashed")',
          "\tos.Exit(3)",
          "}",
          "",
        ].join("\n"),
        "src/main.ts": `const value: number = "type-error";\nconsole.log(value);\n`,
      },
      {
        compilerOptions: {
          plugins: [{ transform: "./plugins/transform.cjs" }],
        },
      },
    );
    for (const args of [
      ["--cwd", root],
      ["--cwd", root, "--noEmit"],
    ]) {
      const result = spawn(ttscBin, args, {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      });

      assert.equal(result.status, 3);
      assert.match(result.stderr, /transform plugin crashed/);
      assert.match(result.stderr, /TS2322/);
    }
  };
