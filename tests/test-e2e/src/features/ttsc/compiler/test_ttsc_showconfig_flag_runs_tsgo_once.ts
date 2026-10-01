import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies a forwarded print-and-exit tsgo flag runs tsgo exactly once.
 *
 * Ttsc runs a `--noEmit` type-check pass before the emit pass. A tsgo flag that
 * prints and exits instead of building — such as `--showConfig` — would
 * otherwise run in both passes and print its output twice. ttsc skips the
 * pre-check when such a flag is forwarded, so the output appears exactly once.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --showConfig`.
 * 3. Assert a zero exit and exactly one rendered config block.
 *
 * @evidence contracts/testing.md#behavioral-verification --showConfig exits zero and stdout contains exactly one compilerOptions block.
 * @evidence contracts/testing.md#independent-expectations Print-and-exit flag requires one rendered config; block count detects double printed precheck/emit routes but does not instrument process count directly.
 * @evidence contracts/testing.md#distinguishing-cases Camelcase terminal config operation versus lowercase policy twin.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_showconfig_flag_runs_tsgo_once is discovered under src/features/ttsc/compiler by @ttsc/test-e2e src/index.ts and TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Real launcher/native print-and-exit connection checks duplicate visible output from build wrapping.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: --showConfig exits zero and stdout contains exactly one compilerOptions block. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_showconfig_flag_runs_tsgo_once = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_showconfig_flag_runs_tsgo_once/inputs-1"));

  const result = spawn(ttscBin, ["--cwd", root, "--showConfig"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const blocks = result.stdout.split('"compilerOptions"').length - 1;
  assert.equal(blocks, 1, `expected one config block, got ${blocks}`);
};
