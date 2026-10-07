import assert from "node:assert/strict";

import { runTrace } from "../../../../packages/graph/src/server/runTrace";
import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies complete and explicit-budget traces recover every caller above the
 * former reverse and impact ceilings without weakening exploratory defaults.
 *
 * 1. Index sixty independently named callers, including a test and exports.
 * 2. Contrast the twelve-node default with a larger numeric budget and complete.
 * 3. Check impact roles, unique callers and complete hop summaries.
 *
 * @evidence contracts/testing.md#behavioral-verification The real runTrace traverses memory indexes for sixty caller edges; assertions compare returned caller identities, default truncation, impact roles and hop summaries, detecting the former hard clamp.
 * @evidence contracts/testing.md#independent-expectations Sixty authored caller declarations each have exactly one direct call to the start; their authored names independently define the complete population and test/export roles follow their explicit node facts and test path.
 * @evidence contracts/testing.md#distinguishing-cases Default twelve-node omission contrasts with numeric 1000 and complete with deliberately tiny numeric budgets; reverse and impact cross both former ceilings, while missing and ambiguous starts preserve resolution behavior.
 * @evidence contracts/testing.md#execution-ownership This source-unit entry invokes the production runner and memory indexes in the current Node process over authored dump facts, without a native producer, installation or host.
 */
export function test_ttscgraph_trace_complete_recovers_every_caller(): void {
  const start = "src/lib.ts#direct:function";
  const callers: ITtscGraphDump.INode[] = Array.from(
    { length: 60 },
    (_, i) => ({
      id: `${i === 0 ? "tests/callers.test.ts" : "src/callers.ts"}#caller${i}:function`,
      name: `caller${i}`,
      kind: "function",
      file: i === 0 ? "tests/callers.test.ts" : "src/callers.ts",
      external: false,
      exported: i % 2 === 0,
    }),
  );
  const graph = createSyntheticGraph(
    [
      {
        id: start,
        name: "direct",
        kind: "function",
        file: "src/lib.ts",
        external: false,
      },
      ...callers,
    ],
    callers.map((caller) => ({ from: caller.id, to: start, kind: "calls" })),
  );
  const expected = callers.map((caller) => caller.id).sort();
  for (const direction of ["reverse", "impact"] as const) {
    const defaults = runTrace(graph, {
      type: "trace",
      from: start,
      direction,
    }).result;
    assert.equal(defaults.reached.length, 12);
    assert.equal(defaults.truncated, true);
    const larger = runTrace(graph, {
      type: "trace",
      from: start,
      direction,
      maxNodes: 1000,
    }).result;
    assert.deepEqual(larger.reached.map((node) => node.id).sort(), expected);
    assert.equal(larger.truncated, false);
    const complete = runTrace(graph, {
      type: "trace",
      from: start,
      direction,
      complete: true,
      maxNodes: 1,
      maxDepth: 1,
    }).result;
    assert.deepEqual(complete.reached.map((node) => node.id).sort(), expected);
    assert.equal(complete.hops.length, 60);
    assert.equal(complete.steps?.length, 60);
    assert.equal(complete.truncated, false);
    assert.deepEqual(
      complete.reached.find((node) => node.name === "caller0")?.roles,
      direction === "impact" ? ["exported", "test"] : undefined,
    );
  }
  assert.equal(
    runTrace(graph, { type: "trace", from: "missing", complete: true }).next
      ?.action,
    "outside",
  );
  const ambiguous = createSyntheticGraph([
    {
      id: "src/a.ts#same:function",
      name: "same",
      kind: "function",
      file: "src/a.ts",
      external: false,
    },
    {
      id: "src/b.ts#same:function",
      name: "same",
      kind: "function",
      file: "src/b.ts",
      external: false,
    },
  ]);
  assert.equal(
    runTrace(ambiguous, { type: "trace", from: "same", complete: true }).next
      ?.action,
    "clarify",
  );
}
