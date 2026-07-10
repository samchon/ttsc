import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  goPath,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

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
