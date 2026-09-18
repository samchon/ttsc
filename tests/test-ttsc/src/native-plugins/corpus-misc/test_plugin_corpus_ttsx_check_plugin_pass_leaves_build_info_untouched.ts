import { TestProject } from "@ttsc/testing";

import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
} from "../../internal/plugin-corpus";

/**
 * Verifies ttsx leaves a project's build information untouched when a check
 * plugin makes the build run a separate TypeScript type-check pass.
 *
 * Pins samchon/ttsc#1404 for the lane its first fix missed. A check-stage
 * plugin that does not report TypeScript diagnostics itself makes the build
 * run `tsgo --noEmit` beside it, and the compiler writes an `incremental`
 * project's build information even with `--noEmit`. That pass received the
 * forwarded flags but not the output isolation the emitting pass had, so a run
 * wrote `build/app.tsbuildinfo` into the project. Both passes now isolate.
 *
 * 1. Create an `incremental` project with `tsBuildInfoFile` whose plugin is a
 *    check-stage Go plugin that prints a warning, plus a script outside
 *    `include`.
 * 2. Run the in-include entry and the script through ttsx.
 * 3. Assert both run and no build information appears in the project.
 */
export const test_plugin_corpus_ttsx_check_plugin_pass_leaves_build_info_untouched =
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
        "src/main.ts": `console.log("entry ran");\n`,
        "scripts/tool.ts": `console.log("tool ran");\nexport {};\n`,
      },
      {
        compilerOptions: {
          incremental: true,
          tsBuildInfoFile: "build/app.tsbuildinfo",
          plugins: [{ transform: "./plugins/check.cjs" }],
        },
      },
    );

    for (const [entry, expected] of [
      ["src/main.ts", "entry ran"],
      ["scripts/tool.ts", "tool ran"],
    ] as const) {
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["--cwd", root, entry],
        {
          cwd: root,
          env: {
            PATH: goPath(),
            TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
          },
        },
      );
      assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
      assert.equal(result.stdout.trim(), expected, entry);
      assert.equal(
        fs.existsSync(path.join(root, "build")),
        false,
        `${entry} wrote build information into the project`,
      );
    }
  };
