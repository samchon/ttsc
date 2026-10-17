import assert from "node:assert/strict";

import {
  hasDeclarationBody,
  runTrace,
} from "../../../../packages/graph/src/server/runTrace";
import {
  type ResolverGraphNode,
  createSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies type-literal members remain bodyless through nested ownership.
 *
 * 1. Build direct and nested type members alongside a concrete implementation and
 *    a variable-bound class-expression method.
 * 2. Require bodyless type members and concrete value members.
 * 3. Trace a type-member call and require dispatch to its concrete implementation.
 *
 * @evidence contracts/testing.md#behavioral-verification The real memory projection and trace predicate must classify direct and nested type members as bodyless while retaining concrete methods, and execution trace must reach the implemented method through checker-shaped relation facts.
 * @evidence contracts/testing.md#independent-expectations Literal type ownership means the signatures have no executable body; the concrete class and variable-owned method remain executable. The authored calls and implements relations prescribe the dispatch destination.
 * @evidence contracts/testing.md#distinguishing-cases Direct and nested type ownership contrast concrete class and variable-bound class methods. Native extraction and checker validity of the supplied implementation relation belong to the Go regression tests.
 * @evidence contracts/testing.md#execution-ownership The exported unit entry calls maintained memory, body classification and trace functions over authored in-memory facts without a native process or installation.
 */
export function test_ttscgraph_type_literal_members_remain_bodyless(): void {
  const node = (
    qualifiedName: string,
    kind: ResolverGraphNode["kind"],
  ): ResolverGraphNode => ({
    id: `src/types.ts#${qualifiedName}:${kind}`,
    name: qualifiedName.split(".").at(-1)!,
    qualifiedName,
    kind,
    file: "src/types.ts",
    external: false,
  });
  const surface = node("Props", "type"),
    direct = node("Props.run", "method"),
    nested = node("Props.nested", "variable"),
    inner = node("Props.nested.run", "method"),
    implementation = node("Concrete", "class"),
    concrete = node("Concrete.run", "method"),
    variable = node("Widget", "variable"),
    expression = node("Widget.run", "method"),
    caller = node("caller", "function");
  const graph = createSyntheticGraph(
    [
      surface,
      direct,
      nested,
      inner,
      implementation,
      concrete,
      variable,
      expression,
      caller,
    ],
    [
      { from: caller.id, to: direct.id, kind: "calls" },
      { from: concrete.id, to: direct.id, kind: "implements" },
    ],
  );
  for (const declaration of [direct, inner])
    assert.equal(hasDeclarationBody(graph, graph.node(declaration.id)!), false);
  for (const declaration of [concrete, expression])
    assert.equal(hasDeclarationBody(graph, graph.node(declaration.id)!), true);
  const result = runTrace(graph, {
    type: "trace",
    from: caller.id,
    focus: "execution",
    complete: true,
  }).result;
  assert.ok(
    result.hops.some(
      (hop) => hop.to === concrete.id && hop.kind === "dispatches",
    ),
  );
}
