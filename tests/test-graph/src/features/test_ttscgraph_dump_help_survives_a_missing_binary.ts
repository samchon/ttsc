import assert from "node:assert/strict";

import { TtscGraphLauncherArguments } from "../../../../packages/graph/src/TtscGraphLauncherArguments";

/**
 * Verifies the missing-binary dump fallback answers help with usage and fails other commands.
 *
 * runDump consults TtscGraphLauncherArguments.missingDump only after binary
 * resolution returns null. Help spellings must then succeed with a usage summary
 * that names the native authority, any other dump must fail with the
 * installation diagnostic, and a resolved binary's help must be forwarded
 * unchanged.
 *
 * 1. Parse each of --help, -help and -h as dump arguments and require code 0, a
 *    "Usage: ttsc-graph dump" stdout naming ttscgraph and no stderr.
 * 2. Require missingDump(["--pretty"]) to return code 1 with the could-not-resolve
 *    stderr diagnostic and no stdout.
 * 3. Require dumpVector(["--help"], null) to forward ["dump", "--help"] and
 *    dumpCompletion({ status: 23 }) to return code 23.
 *
 * @evidence contracts/testing.md#behavioral-verification For each of --help, -help and -h, TtscGraphLauncherArguments.dump must accept the argument and missingDump must return code 0 with a stdout starting "Usage: ttsc-graph dump" that mentions ttscgraph and no stderr; missingDump(["--pretty"]) must return code 1 with the could-not-resolve diagnostic on stderr and no stdout; dumpVector(["--help"], null) must return ["dump", "--help"] and dumpCompletion({ status: 23 }) must return { code: 23 }.
 * @evidence contracts/testing.md#independent-expectations The alias list, the codes 0, 1 and 23, the usage-heading and diagnostic patterns and the literal argv are authored in the test; no executable produces the expected output. Only the heading and the word ttscgraph of the help body are matched, so drift in the rest of the summary is not detected.
 * @evidence contracts/testing.md#distinguishing-cases The three help aliases contrast an ordinary --pretty dump (success with usage versus installation failure), and the forwarded ["dump", "--help"] vector with exit status 23 contrast the fallback with delegation to an installed binary. The missing binary is modeled by calling missingDump directly, not by running runDump.
 * @evidence contracts/testing.md#execution-ownership Calls the pure TtscGraphLauncherArguments operations dump, missingDump, dumpVector and dumpCompletion in the test process; binary resolution, process spawning and the stdout/stderr writes of runDump are not executed.
 */
export function test_ttscgraph_dump_help_survives_a_missing_binary(): void {
  const failures: unknown[] = [];
  for (const flag of ["--help", "-help", "-h"]) {
    try {
      TtscGraphLauncherArguments.dump([flag]);
      const result = TtscGraphLauncherArguments.missingDump([flag]);
      assert.equal(result.code, 0);
      assert.match(result.stdout ?? "", /^Usage: ttsc-graph dump/mu);
      assert.match(result.stdout ?? "", /ttscgraph/u);
      assert.equal(result.stderr, undefined);
    } catch (error) { failures.push(error); }
  }
  try {
    TtscGraphLauncherArguments.dump(["--pretty"]);
    const ordinary = TtscGraphLauncherArguments.missingDump(["--pretty"]);
    assert.equal(ordinary.code, 1);
    assert.match(ordinary.stderr ?? "", /could not resolve the ttscgraph binary/u);
    assert.equal(ordinary.stdout, undefined);
    assert.deepEqual(TtscGraphLauncherArguments.dumpVector(["--help"], null), ["dump", "--help"]);
    assert.deepEqual(TtscGraphLauncherArguments.dumpCompletion({ status: 23 }), { code: 23 });
  } catch (error) { failures.push(error); }
  if (failures.length !== 0) throw new AggregateError(failures, "dump help source controls failed");
}
