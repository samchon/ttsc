import assert from "node:assert/strict";

import { PassthroughFlags } from "../../../../../packages/ttsc/src/compiler/internal/build/PassthroughFlags";

/**
 * Verifies terminal classification follows effective compiler boolean values.
 *
 * A disabled show-config request must keep compilation guards, while an enabled
 * request may finish without compiling. Project-independent terminal commands
 * have a separate responsibility from requests that need a resolved project.
 *
 * 1. Classify authored terminal spellings and their contrasting boolean values.
 * 2. Assert last-occurrence precedence and project-independent ownership.
 * 3. Preserve malformed and unconsumed argv when removing valid boolean flags.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual PassthroughFlags terminal and project-free predicates and withoutBooleanFlags transformation. Literal classifications distinguish disabled requests from print-and-exit requests; exact remaining argv detects accidental removal of malformed or unrelated arguments.
 * @evidence contracts/testing.md#independent-expectations Authored booleans and argv vectors encode the supported compiler policy: names are case-insensitive, the last valid boolean occurrence wins, only lowercase true/false/null values are consumed, and showConfig/listFilesOnly require a project while all/init/help do not. Expectations do not call the schema or another production parser.
 * @evidence contracts/testing.md#distinguishing-cases Covers absent and empty argv, canonical/case/single-dash showConfig, false/null disablement, both repeated-value orders, inline rejection, unconsumed uppercase values, project-bound and project-free terminal requests, ordinary flags and unknown near misses. Removal changes valid selected occurrences while preserving malformed values, source inputs and caller argv.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry invokes the owning classification and argv transformation directly without a fixture project or native producer. The shared compiler experiment separately retains real enabled-terminal output and disabled-terminal diagnostic/emit guards.
 */
export function test_terminal_flags_preserve_effective_boolean_and_project_ownership(): void {
  const cases: readonly [readonly string[], boolean, boolean][] = [
    [[], false, false],
    [["--showConfig"], true, false],
    [["--showconfig"], true, false],
    [["-SHOWCONFIG", "true"], true, false],
    [["--showConfig", "false"], false, false],
    [["--showConfig", "null"], false, false],
    [["--showConfig", "--SHOWCONFIG", "false"], false, false],
    [["--showConfig", "false", "--SHOWCONFIG", "true"], true, false],
    [["--showConfig=false"], false, false],
    [["--showConfig", "FALSE"], true, false],
    [["--listFilesOnly"], true, false],
    [["--listFiles"], false, false],
    [["--all"], true, true],
    [["--init"], true, true],
    [["-?"], true, true],
    [["--all", "false", "--showConfig"], true, false],
    [["--showConfig", "false", "--init"], true, true],
    [["--showConfig2"], false, false],
    [["showConfig"], false, false],
  ];
  const failures: Error[] = [];
  try {
    assert.equal(PassthroughFlags.forwardsTerminalTsgoFlag({}), false);
    assert.equal(
      PassthroughFlags.forwardsProjectFreeTerminalTsgoFlag({}),
      false,
    );
  } catch (cause) {
    failures.push(new Error("absent forwarded argv", { cause }));
  }
  for (const [passthrough, terminal, projectFree] of cases) {
    try {
      assert.equal(
        PassthroughFlags.forwardsTerminalTsgoFlag({ passthrough }),
        terminal,
        `terminal ${JSON.stringify(passthrough)}`,
      );
      assert.equal(
        PassthroughFlags.forwardsProjectFreeTerminalTsgoFlag({ passthrough }),
        projectFree,
        `project-free ${JSON.stringify(passthrough)}`,
      );
    } catch (cause) {
      failures.push(new Error(JSON.stringify(passthrough), { cause }));
    }
  }
  const argv = [
    "--showConfig",
    "false",
    "--SHOWCONFIG",
    "null",
    "-showConfig",
    "true",
    "--showConfig=false",
    "--showConfig",
    "FALSE",
    "main.ts",
    "--listFiles",
  ];
  const original = [...argv];
  try {
    assert.deepEqual(
      PassthroughFlags.withoutBooleanFlags(argv, ["--showConfig"]),
      ["--showConfig=false", "FALSE", "main.ts", "--listFiles"],
    );
    assert.deepEqual(argv, original);
    assert.deepEqual(PassthroughFlags.withoutBooleanFlags(argv, []), original);
  } catch (cause) {
    failures.push(
      new Error("boolean removal preserves compiler-owned argv", { cause }),
    );
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "terminal flag policy failures");
}
