import { TestProject } from "@ttsc/testing";

import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  path,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies ttsx leaves a project's build information untouched when a check
 * plugin makes the build run a separate TypeScript type-check pass.
 *
 * Pins samchon/ttsc#1404 for the lane its first fix missed. A check-stage
 * plugin that does not report TypeScript diagnostics itself makes the build run
 * `tsgo --noEmit` beside it, and the compiler writes an `incremental` project's
 * build information even with `--noEmit`. That pass received the forwarded
 * flags but not the output isolation the emitting pass had, so a run wrote
 * `build/app.tsbuildinfo` into the project. Both passes now isolate.
 *
 * 1. Create an `incremental` project with `tsBuildInfoFile` whose plugin is a
 *    check-stage Go plugin that prints a warning, plus a script outside
 *    `include`.
 * 2. Run the in-include entry and the script through ttsx.
 * 3. Assert both run and no build information appears in the project.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsx runs both included entry and orphan script, asserts their distinct stdout, and leaves no build directory.
 * @evidence contracts/testing.md#independent-expectations The scripts print literal messages and runtime output isolation forbids project tsBuildInfoFile publication.
 * @evidence contracts/testing.md#distinguishing-cases Included and excluded entries require different compile paths; both have an incremental project plus a check child requiring a separate type check.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_ttsx_check_plugin_pass_leaves_build_info_untouched entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary ttsx connects runtime output isolation to both the emitting compiler and separate fallback no-emit compiler invoked beside the real check child. Running the included and orphan entry detects build-info writes from either compile path while proving runtime execution still succeeds.
 * @evidence contracts/e2e.md#shared-execution Included and orphan requests share one authored incremental consumer/check-plugin source and the suite producer cache. Both real launcher invocations remain required by their distinct entry paths. Cache-hit, total process/build counts and minimum preparation are not measured. Each original row is attempted with independently named failures collected.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the consumer and authored check source; shared cache remains suite-owned. The project build directory is initially absent and inspected after each direct synchronous request, without erasing a failed row's writes. Equivalent source/host/toolchain inputs are required for reuse; child-specific environment remains local, direct return does not certify arbitrary descendants or loaded images.
 * @evidence contracts/e2e.md#preserved-coverage ttsx runs both included entry and orphan script, asserts their distinct stdout, and leaves no build directory. These assertions stay in test_plugin_corpus_ttsx_check_plugin_pass_leaves_build_info_untouched with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
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

    assert.equal(fs.existsSync(path.join(root, "build")), false);
    const errors: unknown[] = [];
    for (const [entry, expected] of [
      ["src/main.ts", "entry ran"],
      ["scripts/tool.ts", "tool ran"],
    ] as const) {
      try {
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
        assert.ifError(result.error);
        assert.equal(result.signal, null);
        assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
        assert.equal(result.stdout.trim(), expected, entry);
        assert.equal(
          fs.existsSync(path.join(root, "build")),
          false,
          `${entry} wrote build information into the project`,
        );
      } catch (error) {
        errors.push(
          new Error(`ttsx isolation entry ${entry}`, { cause: error }),
        );
      }
    }
    if (errors.length)
      throw new AggregateError(errors, "ttsx build-info isolation entries");
  };
