import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies a lowercase `--showconfig` prints the project's own resolved config.
 *
 * `--showConfig` is declared terminal, so ttsc must not wrap it in a build. A
 * case variant was not recognised as terminal, so the launcher added its
 * compile-only guard anyway and `noEmitOnError` appeared in the printed
 * configuration — the tool reported a setting the project never declared. The
 * case-variant twin of `test_ttsc_showconfig_flag_runs_tsgo_once`.
 *
 * 1. Create a minimal project that declares no `noEmitOnError`.
 * 2. Run `ttsc --showconfig`.
 * 3. Assert a zero exit, exactly one config block, and no injected `noEmitOnError`
 *    in the printed configuration.
 *
 * @evidence contracts/testing.md#behavioral-verification Lowercase --showconfig exits zero, renders one compilerOptions block and omits noEmitOnError.
 * @evidence contracts/testing.md#independent-expectations Authored config lacks noEmitOnError; terminal resolved-config output must not include injected compile-only policy.
 * @evidence contracts/testing.md#distinguishing-cases Case-variant terminal flag versus camelcase twin; absence of guard and single output are both checked.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_showconfig_flag_in_lowercase_omits_the_compile_only_guard is discovered under src/features/ttsc/compiler by @ttsc/test-e2e src/index.ts and TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual launcher classification and native print-config route reveal compile wrapping invisible in parser-only assertions.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Lowercase --showconfig exits zero, renders one compilerOptions block and omits noEmitOnError. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_showconfig_flag_in_lowercase_omits_the_compile_only_guard =
  () => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_showconfig_flag_in_lowercase_omits_the_compile_only_guard/inputs-1"));

    const result = spawn(ttscBin, ["--cwd", root, "--showconfig"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    const blocks = result.stdout.split('"compilerOptions"').length - 1;
    assert.equal(blocks, 1, `expected one config block, got ${blocks}`);
    assert.equal(
      /noEmitOnError/.test(result.stdout),
      false,
      `the printed config must not carry ttsc's compile-only guard:\n${result.stdout}`,
    );
  };
