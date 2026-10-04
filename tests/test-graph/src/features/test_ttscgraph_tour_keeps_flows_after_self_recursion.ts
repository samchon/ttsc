import assert from "node:assert/strict";

import { runTour } from "../../../../packages/graph/src/server/runTour";
import { runTrace } from "../../../../packages/graph/src/server/runTrace";
import type { ITtscGraphTour } from "../../../../packages/graph/src/structures/ITtscGraphTour";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies a self-recursive first seed cannot suppress a later moving flow.
 *
 * A trace's self-edge records a hop but reaches no new handle. Publishing that
 * empty flow would poison overlap deduplication and hide handle's call to work.
 * Removing only the self-recursive declaration must leave the reported moving
 * flow shape unchanged across the two closed authored graph generations.
 *
 * 1. Build attempt calling itself before handle calling work, with authored
 *    declaration coordinates and module export edges.
 * 2. Check the actual self trace has one back-edge and no reached nodes; tour
 *    attempt before handle and require work plus nonempty reached sets.
 * 3. Tour the counterpart without attempt, compare normalized flow shapes and
 *    require the literal handle-to-work shape from both generations.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual runTrace records attempt's self-call without a reached handle. Actual runTour with attempt as its first entrypoint retains handle reaching work and publishes no empty reached flow. Removing only attempt and its self/export edges yields the same normalized primaryFlow shape, which must also equal the literal handle/work expectation.
 * @evidence contracts/testing.md#independent-expectations Authored literal attempt-to-attempt and handle-to-work edges establish that only work is newly reachable from a moving flow. The two-generation equality is a metamorphic control, strengthened by the independent literal [[handle,[work]]] shape so equal empty outputs cannot pass. No native extraction or producer identity is inferred from the fixture.
 * @evidence contracts/testing.md#distinguishing-cases An explicitly first self-recursive seed contrasts the later moving seed and its no-recursion counterpart. The self trace must contain a back-edge and zero reached nodes, both tours must retain work and exclude empty reached flows, and their normalized shapes must agree. This case does not cover mutual recursion or longer cycles.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit entry calls the actual authored memory, runTrace and runTour operations through createSyntheticGraph in the unit process. It creates no native Program, compiler build, child process, host or installation. The synthetic topology owns portable flow/overlap decisions; native recursive-edge extraction and MCP snapshot delivery remain E2E-owned connections.
 */
export function test_ttscgraph_tour_keeps_flows_after_self_recursion(): void {
  const file = "src/recursive-tour.ts";
  const module = { id: `${file}#module:module`, name: file, kind: "module" as const, file, external: false };
  const attempt = { id: "src/recursive-tour.ts#attempt:function", name: "attempt", kind: "function" as const, file, external: false, exported: true, evidence: { startLine: 1 } };
  const handle = { id: "src/recursive-tour.ts#handle:function", name: "handle", kind: "function" as const, file, external: false, exported: true, evidence: { startLine: 2 } };
  const work = { id: "src/recursive-tour.ts#work:function", name: "work", kind: "function" as const, file, external: false, exported: true, evidence: { startLine: 3 } };
  const nodes = [handle, work];
  const edges = [
    ...nodes.map((node) => ({ from: module.id, to: node.id, kind: "exports" as const })),
    { from: handle.id, to: work.id, kind: "calls" as const },
  ];
  const recursive = createSyntheticGraph([module, attempt, ...nodes], [
    { from: module.id, to: attempt.id, kind: "exports" },
    { from: attempt.id, to: attempt.id, kind: "calls" },
    ...edges,
  ]);
  const counterpart = createSyntheticGraph([module, ...nodes], edges);
  const failures: unknown[] = [];
  try {
    const self = runTrace(recursive, { type: "trace", from: attempt.id, direction: "forward", focus: "execution" }).result;
    assert.deepEqual(self.hops.map(({ from, to, kind }) => [from, to, kind]), [
      ["src/recursive-tour.ts#attempt:function", "src/recursive-tour.ts#attempt:function", "calls"],
    ]);
    assert.deepEqual(self.reached, []);
  } catch (error) { failures.push(new Error("self trace premise", { cause: error })); }
  const tours: ITtscGraphTour[] = [];
  for (const [label, graph, names, question] of [
    ["self-recursion first", recursive, ["attempt", "handle"], "Show `attempt` and `handle`."],
    ["no recursion", counterpart, ["handle"], "Show `handle`."],
  ] as const) {
    try {
      const tour = runTour(graph, { type: "tour", reinterpretations: [...names] }, question).result;
      if (label === "self-recursion first") assert.equal(tour.entrypoints[0]?.id, "src/recursive-tour.ts#attempt:function");
      assert.ok(tour.primaryFlow.some((flow) => flow.reached.some((node) => node.name === "work")));
      for (const flow of tour.primaryFlow) assert.ok(flow.reached.length > 0, `${label}: a flow reached nothing`);
      assert.deepEqual(tour.primaryFlow.map((flow) => [flow.start.name, flow.reached.map((node) => node.name).sort()]), [["handle", ["work"]]]);
      tours.push(tour);
    } catch (error) { failures.push(new Error(label, { cause: error })); }
  }
  if (tours.length === 2) {
    const shape = (tour: ITtscGraphTour): string => JSON.stringify(tour.primaryFlow.map((flow) => [flow.start.name, flow.reached.map((node) => node.name).sort()]));
    try {
      assert.equal(shape(tours[0]!), shape(tours[1]!), "the self-edge must not change the reported moving flows");
    } catch (error) { failures.push(new Error("recursive/nonrecursive shape equality", { cause: error })); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "closed-universe recursive tour scenarios failed");
}
