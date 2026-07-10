import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  goPath,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

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
