import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies a repeated `--diagnostics` takes the value of its last occurrence.
 *
 * TypeScript-Go assigns an option at every occurrence, so `--diagnostics false
 * --diagnostics true` prints timing and the reverse order does not. ttsc read
 * the first occurrence, so its own timing lines disagreed with the compiler's.
 * Plain-lane timing is printed by TypeScript-Go itself; ttsc adds its own
 * `ttsc` total only when it believes timing was requested.
 *
 * 1. Create a valid project.
 * 2. Run ttsc with `--diagnostics false --diagnostics true`, then with `true`
 *    followed by `false`.
 * 3. Assert the first prints timing and the second prints none.
 *
 * @evidence contracts/testing.md#behavioral-verification Two real invocations reverse repeated diagnostics values: false then true must print Check time, and true then false must print no time text. Both commands must exit zero.
 * @evidence contracts/testing.md#independent-expectations Last occurrence wins is the native option contract, and observed compiler timing lines independently expose it. The enabled regex names Check time; the disabled regex broadly forbids time, so unrelated occurrence of that word could make the negative assertion stricter than timing alone.
 * @evidence contracts/testing.md#distinguishing-cases Both orderings of repeated explicit boolean values run over identical valid source. Parser unit decisions cannot replace the actual emitted native timing stream checked here.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_diagnostics_flag_follows_the_last_occurrence in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by the unit-module executor.
 * @evidence contracts/e2e.md#necessary-boundary Public flag forwarding and ttsc timing selection must agree with actual TypeScript-Go stdout/stderr. Direct option resolution cannot show the native timing channel reflects the effective occurrence.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams. Two child invocations share one immutable consumer because only diagnostics ordering changes; both exited processes are necessary to compare actual timing output.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_diagnostics_flag_follows_the_last_occurrence. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_diagnostics_flag_follows_the_last_occurrence = () => {
  const root = createProject(FixtureFiles.read("ttsc/ttsc_diagnostics_flag_follows_the_last_occurrence/inputs-1"));

  const enabled = spawn(
    ttscBin,
    ["--cwd", root, "--diagnostics", "false", "--diagnostics", "true"],
    { cwd: root },
  );
  assert.equal(enabled.status, 0, enabled.stderr);
  assert.match(enabled.stdout + enabled.stderr, /Check time/i);

  const disabled = spawn(
    ttscBin,
    ["--cwd", root, "--diagnostics", "true", "--diagnostics", "false"],
    { cwd: root },
  );
  assert.equal(disabled.status, 0, disabled.stderr);
  assert.doesNotMatch(disabled.stdout + disabled.stderr, /time/i);
};
