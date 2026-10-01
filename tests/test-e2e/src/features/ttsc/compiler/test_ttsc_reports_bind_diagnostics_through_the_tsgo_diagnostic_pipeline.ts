import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies ttsc reports bind-phase diagnostics through the tsgo pipeline.
 *
 * Bind errors (e.g. duplicate `let` declarations) are reported during the bind
 * phase, not the type-check phase. Pins that these errors reach stderr through
 * the same diagnostic pipeline as semantic errors and still prevent emit,
 * ensuring no category of compiler error is silently swallowed between the Go
 * backend and the JS launcher.
 *
 * 1. Create a project with a duplicate `let value` declaration in the same scope.
 * 2. Run `ttsc --emit`.
 * 3. Assert non-zero exit, the redeclaration message on stderr, and no
 *    `dist/main.js`.
 *
 * @evidence contracts/testing.md#behavioral-verification Real --emit exits nonzero with duplicate value diagnostic and writes no dist/main.js.
 * @evidence contracts/testing.md#independent-expectations Duplicate block-scoped let is TypeScript bind error; literal redeclaration message and absent output independently pin noEmitOnError.
 * @evidence contracts/testing.md#distinguishing-cases Bind-phase duplicate declaration with emit requested; semantic errors have separate cases.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_reports_bind_diagnostics_through_the_tsgo_diagnostic_pipeline is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Native bind diagnostics must cross tsgo and JS launcher stderr/status, with final emit blocked.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Real --emit exits nonzero with duplicate value diagnostic and writes no dist/main.js. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_reports_bind_diagnostics_through_the_tsgo_diagnostic_pipeline =
  () => {
    const root = createProject(FixtureFiles.read("ttsc/ttsc_reports_bind_diagnostics_through_the_tsgo_diagnostic_pipeline/inputs-1"));

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Cannot redeclare block-scoped variable 'value'/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  };
