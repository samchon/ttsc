import assert from "node:assert/strict";

import { TtscGraphLinePeer } from "../../../../packages/graph/src/model/TtscGraphLinePeer";

/**
 * Verifies joined peer release does not require a successful task exit status.
 *
 * The real Node close callback uses this decision after stdio joining. Its
 * numeric work status belongs to the separate exit event, not release success.
 *
 * 1. Qualify normal joined zero and nonzero exits as successful retirement.
 * 2. Reject unknown status, signals and forced termination with literal errors.
 * 3. Preserve the original transport Error even with other failure coordinates.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual production-used retirementError decision; numeric normal exits yield undefined, unsafe coordinates yield the literal shutdown error, and transport failure preserves Error identity.
 * @evidence contracts/testing.md#independent-expectations The authoritative-close contract separates task status from release; literal input tuples, expected messages and original Error identity do not reproduce an implementation calculation.
 * @evidence contracts/testing.md#distinguishing-cases Zero versus two and seventeen distinguish successful and failed work with equally joined release; unknown code, signal and forced status independently forbid success; a transport Error also takes precedence over concurrent failure coordinates. Unjoined deadlines are outside this post-close predicate and are covered by state release refusal.
 * @evidence contracts/testing.md#execution-ownership The matching unit entry calls the source operation in process; it starts no native child, proves no kernel or pipe join, and does not replace process APIs.
 */
export function test_ttscgraph_peer_retirement_separates_work_status_from_release(): void {
  const failures: Error[] = [];
  const transport = new Error("authored transport failure");
  const cases: {
    name: string;
    code: number | null;
    signal: NodeJS.Signals | null;
    forced: boolean;
    failure?: Error;
    expected?: string | Error;
  }[] = [
    { name: "joined zero", code: 0, signal: null, forced: false },
    {
      name: "joined unsupported command",
      code: 2,
      signal: null,
      forced: false,
    },
    { name: "joined failed graph task", code: 17, signal: null, forced: false },
    {
      name: "unknown status",
      code: null,
      signal: null,
      forced: false,
      expected:
        "@ttsc/graph: peer shutdown failed (code=null, signal=null, forced=false)",
    },
    {
      name: "signal",
      code: null,
      signal: "SIGTERM",
      forced: false,
      expected:
        "@ttsc/graph: peer shutdown failed (code=null, signal=SIGTERM, forced=false)",
    },
    {
      name: "signal cannot be hidden by numeric code",
      code: 0,
      signal: "SIGTERM",
      forced: false,
      expected:
        "@ttsc/graph: peer shutdown failed (code=0, signal=SIGTERM, forced=false)",
    },
    {
      name: "forced zero",
      code: 0,
      signal: null,
      forced: true,
      expected:
        "@ttsc/graph: peer shutdown failed (code=0, signal=null, forced=true)",
    },
    {
      name: "forced nonzero",
      code: 2,
      signal: null,
      forced: true,
      expected:
        "@ttsc/graph: peer shutdown failed (code=2, signal=null, forced=true)",
    },
    {
      name: "transport",
      code: 0,
      signal: null,
      forced: false,
      failure: transport,
      expected: transport,
    },
    {
      name: "transport with other failures",
      code: null,
      signal: "SIGKILL",
      forced: true,
      failure: transport,
      expected: transport,
    },
  ];
  for (const input of cases) {
    try {
      const result = TtscGraphLinePeer.retirementError(
        input.code,
        input.signal,
        input.forced,
        input.failure,
      );
      if (typeof input.expected === "string") {
        assert.ok(result instanceof Error);
        assert.equal(result.message, input.expected);
      } else assert.equal(result, input.expected);
    } catch (error) {
      failures.push(
        new Error(`${input.name}: ${String(error)}`, { cause: error }),
      );
    }
  }
  if (failures.length > 0)
    throw new AggregateError(
      failures,
      "peer retirement decision matrix failed",
    );
}
