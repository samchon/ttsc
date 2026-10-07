import assert from "node:assert/strict";

import { runTrace } from "../../../../packages/graph/src/server/runTrace";
import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies full-depth traversal and path search terminate on cycles and
 * preserve converging relations beyond the exploratory hop budget.
 *
 * 1. Walk a twenty-edge chain with a cycle and contrast default and complete.
 * 2. Find its shortest path with complete or an explicit larger depth budget.
 * 3. Walk a dense ten-node graph and preserve all ninety directed relations.
 *
 * @evidence contracts/testing.md#behavioral-verification runTrace returns the authored chain, cyclic back-edge and dense relation set; path assertions require the twenty-edge shortest path and bounded failures must identify incompleteness.
 * @evidence contracts/testing.md#independent-expectations A linear chain has the unique forward path n0 through n20, and ten nodes with one directed call per unequal ordered pair have ninety relations. These authored mathematical populations define the oracle independently of traversal order.
 * @evidence contracts/testing.md#distinguishing-cases Three-hop default, explicit depth beyond the former open/path ceilings in all directions, complete overriding one-depth, self path, disconnected target and a directed cycle distinguish depth and termination; dense convergence contrasts twenty-hop omission with ninety-hop completion.
 * @evidence contracts/testing.md#execution-ownership The source-unit runner calls production runTrace and memory in process over synthetic compiler-shaped facts; no child process, installation or native build executes.
 */
export function test_ttscgraph_trace_complete_preserves_deep_cyclic_flow(): void {
  const nodes: ITtscGraphDump.INode[] = Array.from({ length: 22 }, (_, i) => ({
    id: `src/chain.ts#n${i}:function`,
    name: `n${i}`,
    kind: "function",
    file: "src/chain.ts",
    external: false,
  }));
  const edges: ITtscGraphDump.IEdge[] = Array.from({ length: 20 }, (_, i) => ({
    from: nodes[i]!.id,
    to: nodes[i + 1]!.id,
    kind: "calls",
  }));
  edges.push({ from: nodes[20]!.id, to: nodes[0]!.id, kind: "calls" });
  const graph = createSyntheticGraph(nodes, edges);
  const defaults = runTrace(graph, { type: "trace", from: "n0" }).result;
  assert.equal(defaults.reached.length, 3);
  assert.equal(defaults.truncated, true);
  const complete = runTrace(graph, {
    type: "trace",
    from: "n0",
    complete: true,
    maxDepth: 1,
    maxNodes: 1,
  }).result;
  assert.equal(complete.reached.length, 20);
  assert.equal(complete.hops.length, 21);
  assert.equal(complete.truncated, false);
  assert.equal(new Set(complete.reached.map((node) => node.id)).size, 20);
  for (const direction of ["forward", "reverse", "impact"] as const) {
    const larger = runTrace(graph, {
      type: "trace",
      from: "n0",
      direction,
      maxDepth: 21,
      maxNodes: 100,
    }).result;
    assert.equal(larger.reached.length, 20);
    assert.equal(larger.hops.length, 21);
    assert.equal(larger.truncated, false);
  }
  const bounded = runTrace(graph, {
    type: "trace",
    from: "n0",
    to: "n20",
  }).result;
  assert.equal(bounded.truncated, true);
  assert.deepEqual(bounded.path, []);
  for (const options of [{ complete: true, maxDepth: 1 }, { maxDepth: 20 }]) {
    const path = runTrace(graph, {
      type: "trace",
      from: "n0",
      to: "n20",
      ...options,
    }).result;
    assert.deepEqual(
      path.path?.map((node) => node.name),
      Array.from({ length: 21 }, (_, i) => `n${i}`),
    );
    assert.equal(path.hops.length, 20);
    assert.equal(path.truncated, false);
  }
  const self = runTrace(graph, {
    type: "trace",
    from: "n0",
    to: "n0",
    complete: true,
  }).result;
  assert.deepEqual(
    self.path?.map((node) => node.name),
    ["n0"],
  );
  assert.equal(self.truncated, false);
  const absent = runTrace(graph, {
    type: "trace",
    from: "n0",
    to: "n21",
    complete: true,
  });
  assert.equal(absent.result.truncated, false);
  assert.deepEqual(absent.result.path, []);
  assert.equal(absent.next?.action, "outside");
  const denseEdges: ITtscGraphDump.IEdge[] = [];
  for (const from of nodes.slice(0, 10))
    for (const to of nodes.slice(0, 10))
      if (from !== to)
        denseEdges.push({ from: from.id, to: to.id, kind: "calls" });
  const dense = createSyntheticGraph(nodes.slice(0, 10), denseEdges);
  const limited = runTrace(dense, {
    type: "trace",
    from: "n0",
    maxNodes: 10,
  }).result;
  assert.equal(limited.hops.length, 20);
  assert.equal(limited.truncated, true);
  const full = runTrace(dense, {
    type: "trace",
    from: "n0",
    complete: true,
  }).result;
  assert.equal(full.hops.length, 90);
  assert.equal(full.truncated, false);
  assert.deepEqual(
    full.hops.map((edge) => `${edge.from}->${edge.to}`).sort(),
    denseEdges.map((edge) => `${edge.from}->${edge.to}`).sort(),
  );
}
