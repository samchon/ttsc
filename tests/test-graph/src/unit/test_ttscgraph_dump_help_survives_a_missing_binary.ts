import assert from "node:assert/strict";

import { TtscGraphLauncherArguments } from "../../../../packages/graph/src/TtscGraphLauncherArguments";

/**
 * Verifies absent-producer help and native forwarding keep distinct completion.
 *
 * The actual launcher consumes this fallback only after resolution returns null.
 * Fixed text/status and all help aliases need no fabricated native executable;
 * the installed batch retains missing-install and genuine native help dispatch.
 *
 * 1. Parse all three original help aliases and require usage/native authority/code zero.
 * 2. Require ordinary dump failure and its owned installation guidance.
 * 3. Preserve the original complete native-help argv and literal status23 mapping.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored dump grammar and actual missingDump completion accept all three help aliases with code zero/usage/native authority; ordinary pretty dump returns code one and the owned resolution diagnostic. Actual vector/completion operations preserve dump-help argv and literal native status23.
 * @evidence contracts/testing.md#independent-expectations Literal aliases, zero/one/23 codes, usage heading, native-authority name and complete argv independently define fallback versus delegated completion; no executable creates expected output.
 * @evidence contracts/testing.md#distinguishing-cases Missing-install help contrasts ordinary missing-install failure and native dispatch; all three aliases share the real fallback owner while installed native help remains authoritative.
 * @evidence contracts/testing.md#execution-ownership This src/unit export imports the authored namespace consumed by runDump and executes pure parsed-token/completion operations. The separate installed CLI batch owns actual resolution, channel writing, process status and genuine native help.
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
