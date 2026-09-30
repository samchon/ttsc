import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies positional `ttsc <file.ts>` type-checks a `noEmit` project that
 * declares no `rootDir` without writing anything.
 *
 * This is the exact command the issue reports failing with TS5011 and exit 2.
 * Single-file mode always emits into its private temp directory — even for a
 * `noEmit` project, because that is how it obtains the transformed text — so
 * the injected `outDir` reaches tsgo either way, while `noEmit` still decides
 * whether anything is copied into the user's tree. Both halves have to hold at
 * once: exit 0, and not one file written (issue #1172).
 *
 * 1. Build a `noEmit` project with a nested source and no `rootDir`.
 * 2. Run `ttsc src/main.ts`.
 * 3. Assert the run succeeded and no JavaScript reached the source tree.
 *
 * @evidence contracts/testing.md#behavioral-verification Positional nested main.ts under noEmit/no rootDir exits zero without adjacent src/main.js.
 * @evidence contracts/testing.md#independent-expectations Authored noEmit prohibits materialized JavaScript; successful status catches TS5011 private-layout rejection. Only the named adjacent JS path is checked.
 * @evidence contracts/testing.md#distinguishing-cases Single-file noEmit with absent rootDir/outDir, distinct from emitting sibling-name twin.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_single_file_checks_a_noemit_project_that_declares_no_rootdir is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Real launcher temporary native emit and final user-tree materialization must respect noEmit despite internal output layout.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Positional nested main.ts under noEmit/no rootDir exits zero without adjacent src/main.js. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_single_file_checks_a_noemit_project_that_declares_no_rootdir =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value: string = "check-only";\n`,
      },
      {
        compilerOptions: {
          noEmit: true,
          outDir: undefined,
          rootDir: undefined,
        },
      },
    );

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "src/main.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(
      fs.existsSync(path.join(root, "src", "main.js")),
      false,
      "a noEmit project wrote JavaScript into its source tree",
    );
  };
