import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

/**
 * Verifies compiler corpus: single-file mode honors tsconfig noEmit without
 * outDir.
 *
 * Without an `outDir`, the compatibility lane's fallback would write a
 * JavaScript sibling beside the source. A resolved `noEmit` must suppress that
 * write, while explicit `--emit` retains the project lane's documented
 * override.
 *
 * 1. Materialize a no-emit project without an output directory.
 * 2. Run one positional file and assert its JavaScript sibling is absent.
 * 3. Repeat with `--emit` and assert the sibling is intentionally written.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs positional source under tsconfig noEmit without outDir; asserts success, no sibling JavaScript and no emitted-path stdout, then adds emit and asserts successful sibling creation.
 * @evidence contracts/testing.md#independent-expectations Configured noEmit suppresses compatibility fallback writes, while explicit emit restores them. Literal sibling absence/presence and printed-path absence independently specify the precedence contract.
 * @evidence contracts/testing.md#distinguishing-cases Owns missing outDir, config-selected noEmit and explicit emit overriding it in the same project. Other entries own project mode and analysis-only boolean spellings.
 * @evidence contracts/testing.md#execution-ownership E2E export test_compiler_corpus_single_file_honors_tsconfig_noemit_without_outdir is discovered under src/features/compiler by TestExecutor; it owns every local project.run/cases/helper assertion and invokes the built ttsc launcher rather than treating authored configuration as an output.
 * @evidence contracts/e2e.md#necessary-boundary The positional compatibility dispatcher must carry config noEmit and CLI emit precedence through the real native emission and final user-tree write.
 * @evidence contracts/e2e.md#shared-execution Two commands share one project intentionally: suppression must leave the initial tree free of JavaScript before the explicit positive command. Native compiler/package preparation is reused.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fresh root starts without a sibling; the first command is joined and inspected before the override writes it. TestProject owns the root at exit and no cache deletion is used between states.
 * @evidence contracts/e2e.md#preserved-coverage All suppressed status, sibling/stdout absence and override status/sibling presence assertions remain. This case does not execute the emitted sibling or inspect its contents.
 */
export const test_compiler_corpus_single_file_honors_tsconfig_noemit_without_outdir =
  (): void => {
    const root = createProject(FixtureFiles.read("ttsc/compiler_corpus_single_file_honors_tsconfig_noemit_without_outdir/inputs-1"));
    const output = path.join(root, "src", "main.js");

    const suppressed = spawn(ttscBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
    });
    assert.equal(suppressed.status, 0, suppressed.stderr);
    assert.equal(fs.existsSync(output), false);
    assert.equal(suppressed.stdout.includes("main.js"), false);

    const override = spawn(ttscBin, ["--cwd", root, "--emit", "src/main.ts"], {
      cwd: root,
    });
    assert.equal(override.status, 0, override.stderr);
    assert.equal(fs.existsSync(output), true);
  };
