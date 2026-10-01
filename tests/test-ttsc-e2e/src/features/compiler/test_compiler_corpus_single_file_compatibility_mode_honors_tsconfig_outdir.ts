import {
  assert,
  commonJsProject,
  fs,
  path,
  runNode,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "single file compatibility mode honors tsconfig outDir",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value: number = 7;\nconsole.log(value.toString());\n`,
    }),
  run(root: string) {
    const result = spawn(ttscBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);

    // tsconfig has outDir=dist + rootDir=src, so the emitted JS lands at
    // dist/main.js — NOT src/main.js next to the source.
    const expected = path.join(root, "dist", "main.js");
    const stale = path.join(root, "src", "main.js");
    assert.equal(
      fs.existsSync(expected),
      true,
      `expected emit at ${expected}, stdout=${result.stdout}`,
    );
    assert.equal(
      fs.existsSync(stale),
      false,
      `no JS should be dropped next to src/main.ts, but found ${stale}`,
    );

    const run = runNode(expected, { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "7");
  },
};

/**
 * Verifies compiler corpus: single file compatibility mode honors tsconfig
 * outDir.
 *
 * Pins the contract that `ttsc <file.ts>` without `--outDir` emits to the
 * tsconfig's `outDir` (mirroring the rootDir → outDir layout), instead of
 * dropping the JS next to the TS source. Regression for the long-standing
 * complaint that single-file invocations like `ttsc src/main.ts` leaked
 * `src/main.js` siblings even when the project clearly configured `outDir`.
 *
 * 1. Materialize a CommonJS fixture with rootDir=src and outDir=dist.
 * 2. Run `ttsc src/main.ts` with no `--outDir` override.
 * 3. Assert the emit lands at `dist/main.js` and that `src/main.js` is absent.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs positional src/main.ts with no outDir override, asserts successful emit at dist/main.js and no src/main.js sibling, then runs the emitted file and checks status zero and stdout 7.
 * @evidence contracts/testing.md#independent-expectations Configured rootDir src/outDir dist governs positional compatibility output, and the authored numeric program must print 7. Native Node execution provides an independent runtime oracle beyond output existence.
 * @evidence contracts/testing.md#distinguishing-cases Owns tsconfig-selected output destination versus source-sibling absence and preserved runtime behavior. Explicit outDir and noEmit positional branches have their own entries.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_single_file_compatibility_mode_honors_tsconfig_outdir is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary Positional launcher dispatch must retain resolved tsconfig layout and native-produced JavaScript must execute; direct path/option units cannot verify this compiler-to-runtime connection.
 * @evidence contracts/e2e.md#shared-execution One compile and one Node runtime process share the same output. Existing compiler/launcher installation is reused, and the runtime consumer needs no additional native build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh root prevents stale dist or source-sibling files; synchronous compile precedes runtime and both children finish before cleanup. TestProject owns source/output roots until exit.
 * @evidence contracts/e2e.md#preserved-coverage Emit destination, forbidden sibling, successful runtime status and literal stdout remain in project.run. Every original observation remains attached to this named entry.
 */
export const test_compiler_corpus_single_file_compatibility_mode_honors_tsconfig_outdir =
  (): void => {
    const root = project.root();
    project.run(root);
  };
