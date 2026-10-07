import assert from "node:assert/strict";

import { runTrace } from "../../../../packages/graph/src/server/runTrace";
import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";
import { createSyntheticGraph } from "../internal/resolverGraph";

/**
 * Verifies completeness admits bodyless dispatch while retaining focus,
 * external-node and structural policies in both traversal directions.
 *
 * 1. Author thirteen concrete implementations, one abstract base and its caller.
 * 2. Contrast bounded dispatch omission with complete forward, reverse and path.
 * 3. Check execution versus types, optional external leaves and file exclusion.
 *
 * @evidence contracts/testing.md#behavioral-verification The real runTrace follows every concrete implementation of a bodyless member in complete mode, returns the calling symbol in reverse and impact, and preserves the selected execution/type, external and structural exclusions.
 * @evidence contracts/testing.md#independent-expectations Authored overrides connect thirteen concrete methods to an explicitly abstract base; a single calls edge connects the caller. This supplies the expected dispatch population and reverse route independently of traversal helpers.
 * @evidence contracts/testing.md#distinguishing-cases Thirteen implementations exceed the hub cut; bounded mode omits them while complete includes them. Execution excludes type references, types excludes synthetic dispatch, external inclusion admits only its opted-in leaf, a synthesized file's containment does not become executable flow, and duplicate override/implements facts dispatch only once per implementation.
 * @evidence contracts/testing.md#execution-ownership This discoverable source-unit entry runs production traversal and memory indexes in process with authored declaration facts and no native compiler, installed artifact or MCP host.
 */
export function test_ttscgraph_trace_complete_respects_admitted_graph_policy(): void {
  const node = (name: string, extra: Partial<ITtscGraphDump.INode> = {}): ITtscGraphDump.INode => ({
    id: `${extra.file ?? "src/dispatch.ts"}#${name}:${extra.kind ?? "method"}`, name, kind: "method", file: "src/dispatch.ts", external: false, ...extra,
  });
  const caller = node("caller", { exported: true });
  const base = node("base", { modifiers: ["abstract"] });
  const implementations = Array.from({ length: 13 }, (_, i) => node(`impl${i}`));
  const external = node("external", { file: "node_modules/api/index.d.ts", external: true });
  const type = node("Shape", { kind: "interface" });
  const edges: ITtscGraphDump.IEdge[] = [
    { from: caller.id, to: base.id, kind: "calls" },
    { from: base.id, to: type.id, kind: "type_ref" },
    { from: implementations[0]!.id, to: external.id, kind: "calls" },
    ...implementations.map((implementation) => ({ from: implementation.id, to: base.id, kind: "overrides" as const })),
    { from: implementations[0]!.id, to: base.id, kind: "implements" },
  ];
  const graph = createSyntheticGraph([caller, base, ...implementations, external, type], edges);
  const file = graph.nodes.find((entry) => entry.kind === "file" && entry.file === "src/dispatch.ts")!;
  assert.ok(file);
  assert.ok(graph.outgoing(file.id).some((edge) => edge.kind === "contains"));
  assert.deepEqual(runTrace(graph, { type: "trace", from: file.id, complete: true }).result.reached, []);
  const bounded = runTrace(graph, { type: "trace", from: caller.id, focus: "execution", maxNodes: 100 }).result;
  assert.equal(bounded.truncated, true);
  assert.deepEqual(bounded.reached.map((entry) => entry.name), ["base"]);
  const full = runTrace(graph, { type: "trace", from: caller.id, focus: "execution", complete: true }).result;
  assert.equal(full.truncated, false);
  assert.equal(full.reached.length, 14);
  assert.equal(full.hops.filter((edge) => edge.kind === "dispatches").length, 13);
  assert.deepEqual(full.reached.map((entry) => entry.name).sort(), ["base", ...implementations.map((entry) => entry.name)].sort());
  const inclusive = runTrace(graph, { type: "trace", from: caller.id, focus: "execution", complete: true, includeExternal: true }).result;
  assert.equal(inclusive.reached.length, 15);
  assert.equal(inclusive.reached.some((entry) => entry.name === "external"), true);
  assert.equal(inclusive.reached.some((entry) => entry.kind === "file"), false);
  for (const direction of ["reverse", "impact"] as const) {
    const reverse = runTrace(graph, { type: "trace", from: implementations[0]!.id, direction, focus: "execution", complete: true }).result;
    assert.deepEqual(reverse.reached.map((entry) => entry.name).sort(), ["base", "caller"]);
    assert.equal(reverse.truncated, false);
    assert.equal(reverse.hops.some((edge) => edge.kind === "dispatches" && edge.to === implementations[0]!.id), true);
  }
  const all = runTrace(graph, { type: "trace", from: caller.id, focus: "all", complete: true }).result;
  assert.equal(all.reached.length, 15);
  assert.equal(all.reached.some((entry) => entry.name === "Shape"), true);
  assert.equal(all.hops.filter((edge) => edge.kind === "dispatches").length, 13);
  assert.equal(all.truncated, false);
  const typed = runTrace(graph, { type: "trace", from: base.id, focus: "types", complete: true }).result;
  assert.deepEqual(typed.reached.map((entry) => entry.name), ["Shape"]);
  assert.equal(typed.hops.some((edge) => edge.kind === "dispatches"), false);
  const pathBounded = runTrace(graph, { type: "trace", from: caller.id, to: implementations[12]!.id, focus: "execution" }).result;
  assert.equal(pathBounded.truncated, true);
  const path = runTrace(graph, { type: "trace", from: caller.id, to: implementations[12]!.id, focus: "execution", complete: true }).result;
  assert.deepEqual(path.path?.map((entry) => entry.name), ["caller", "base", "impl12"]);
  assert.equal(path.truncated, false);
}
