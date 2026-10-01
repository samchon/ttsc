import {
  assert,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies ttsc reports the native tsgo version banner.
 *
 * The `--version` output must include both the `ttsc` version and the
 * underlying native TypeScript (TypeScript-Go) version so users can report
 * reproducible bugs. Pins the banner format and the presence of the native
 * TypeScript 7 version string so a version-banner regression surfaces
 * immediately in CI.
 *
 * 1. Run the real `ttsc` launcher with `--version` and workspace binary overrides.
 * 2. Assert exit 0.
 * 3. Assert stdout starts with `ttsc ` and contains `Version 7.`.
 *
 * @evidence contracts/testing.md#behavioral-verification Real --version exits zero, starts ttsc and includes Version 7 in parentheses.
 * @evidence contracts/testing.md#independent-expectations Banner contract names adapter and native compiler versions; regex checks major/shape rather than exact release or consumer-local selection.
 * @evidence contracts/testing.md#distinguishing-cases Terminal version banner under workspace binary override; fake consumer repair has its own case.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_reports_the_consumer_tsgo_version_banner is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Launcher actually invokes workspace native compiler through helper override; this case does not establish consumer-local resolution despite its name.
 * @evidence contracts/e2e.md#shared-execution One terminal CLI process reuses installed workspace launcher/binaries; no fixture project or plugin build is prepared. Help does not invoke semantic compilation; version only asks native version.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Captured stdout/stderr/status belong to this synchronous child; binary overrides are passed in child environment without global mutation. No filesystem output is modified by this case and abrupt cancellation is not verified.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Real --version exits zero, starts ttsc and includes Version 7 in parentheses. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_reports_the_consumer_tsgo_version_banner = () => {
  const result = spawn(ttscBin, ["--version"], { cwd: workspaceRoot });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ttsc /);
  assert.match(result.stdout, /\(Version 7\./);
};
