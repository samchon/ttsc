import {
  assert,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../internal/ttsc/internal/toolchain";

/**
 * Verifies ttsc reports the public command help entries.
 *
 * The `--help` output is the user-facing command reference.
 * Pins the presence of the main commands (`prepare`, `clean`,
 * `fix`, `format`, `cache paths`) and the plugin-contract section so
 * documentation drift or accidental command removal is caught before a
 * release.
 *
 * 1. Run the real `ttsc` launcher with `--help` from the workspace root.
 * 2. Assert exit 0 and the tagline on stdout.
 * 3. Assert each public command name and the `Plugin contract:` section appear.
 *
 * @evidence contracts/testing.md#behavioral-verification Real --help exits zero and stdout contains tagline, prepare/clean/fix/format/cache paths syntax and Plugin contract heading.
 * @evidence contracts/testing.md#independent-expectations Public command names/syntax are deliberate literal user-interface expectations; only their presence, not complete help accuracy, is asserted.
 * @evidence contracts/testing.md#distinguishing-cases Help terminal command without project/build; individual command behavior remains separately tested.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_reports_help_text_for_public_commands is discovered under src/features/ttsc/compiler by @ttsc/test-e2e src/index.ts and TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual launcher argument route and stdout rendering execute; no compiler host or project is needed.
 * @evidence contracts/e2e.md#shared-execution One terminal CLI process reuses installed workspace launcher/binaries; no fixture project or plugin build is prepared. Help does not invoke semantic compilation; version only asks native version.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Captured stdout/stderr/status belong to this synchronous child; binary overrides are passed in child environment without global mutation. No filesystem output is modified by this case and abrupt cancellation is not verified.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Real --help exits zero and stdout contains tagline, prepare/clean/fix/format/cache paths syntax and Plugin contract heading. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_reports_help_text_for_public_commands = () => {
  const result = spawn(ttscBin, ["--help"], { cwd: workspaceRoot });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /standalone compiler adapter and plugin host/);
  assert.match(result.stdout, /ttsc prepare \[options\]/);
  assert.match(result.stdout, /ttsc clean \[options\]/);
  assert.match(result.stdout, /ttsc fix \[options\]/);
  assert.match(result.stdout, /ttsc format \[options\]/);
  assert.match(result.stdout, /ttsc cache paths --json/);
  assert.match(result.stdout, /Plugin contract:/);
};
