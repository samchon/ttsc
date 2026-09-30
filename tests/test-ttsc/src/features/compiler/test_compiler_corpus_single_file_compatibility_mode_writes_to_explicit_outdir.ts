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
  name: "single file compatibility mode writes to explicit outDir",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value: number = 7;\nconsole.log(value.toString());\n`,
    }),
  run(root: string) {
    const result = spawn(
      ttscBin,
      ["--cwd", root, "--outDir", "single", "src/main.ts"],
      {
        cwd: root,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const output = path.join(root, "single", "src", "main.js");
    assert.equal(fs.existsSync(output), true);
    const run = runNode(output, { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "7");
  },
};

/**
 * Verifies compiler corpus: single-file compatibility mode writes to an
 * explicit `--outDir` when provided.
 *
 * When `--outDir` is supplied alongside a positional file argument, the emitted
 * JS must land in `<outDir>/<source-relative-path>` rather than next to the
 * source file. Pins the `--outDir` override path in single-file mode so scripts
 * that need to direct output elsewhere can do so without editing the tsconfig.
 *
 * 1. Materialize a CommonJS project with a configured `outDir: dist` in tsconfig.
 * 2. Run `ttsc --outDir single src/main.ts`.
 * 3. Assert `single/src/main.js` is written and executes successfully.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs positional src/main.ts with outDir single over configured dist; asserts success, single/src/main.js existence, then executes that output and checks successful status and stdout 7.
 * @evidence contracts/testing.md#independent-expectations The explicit compatibility output directory overrides the configured destination while retaining the source-relative path. Authored location and numeric program stdout are independent of the emit implementation.
 * @evidence contracts/testing.md#distinguishing-cases Owns explicit outDir selection plus runtime meaning, complementing the configured-outDir entry. It does not separately assert dist/main.js absence.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_single_file_compatibility_mode_writes_to_explicit_outdir is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The CLI override must reach positional native emit and produce JavaScript accepted by Node at the selected destination; option parsing alone does not establish this connection.
 * @evidence contracts/e2e.md#shared-execution One compile followed by one Node consumer uses the same fixture/output. Built packages/native compiler are shared, without per-case plugin compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A unique root separates single/src/main.js from every other case output and compilation finishes before runtime. Both commands are synchronous; TestProject reclaims the root at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Exit success, explicit-path existence and runtime status/stdout remain in project.run; no additional default-path absence check is claimed.
 */
export const test_compiler_corpus_single_file_compatibility_mode_writes_to_explicit_outdir =
  (): void => {
    const root = project.root();
    project.run(root);
  };
