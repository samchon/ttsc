import { TestProject } from "@ttsc/testing";

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
} from "../../internal/plugin-corpus";

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
 */
export const test_plugin_corpus_check_plugin_output_does_not_suppress_typescript_diagnostics =
  () => {
    const root = commonJsProject(
      {
        "plugins/check.cjs": `module.exports = {
        name: "warning-check",
        source: require("node:path").resolve(__dirname, "check-go"),
        stage: "check",
      };\n`,
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
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-check-"),
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /TS9001: check warning/);
    assert.match(result.stderr, /TS2322/);
  };
