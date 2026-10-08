import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  createSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies object containment preserves bracketed literal keys and nested keys.
 *
 * 1. Author a variable object with a dotted literal method, a nested method,
 *    empty/escaped keys, a bracket-text collision and namespace/class
 *    controls.
 * 2. Build memory from those producer coordinates.
 * 3. Require each member's actual lexical owner and distinct identity.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphMemory.from must preserve separate dotted-literal and nested method IDs and connect JSON-bracketed keys to the exact owner, including escaped Unicode and quotes.
 * @evidence contracts/testing.md#independent-expectations Literal authored simple names, qualified names and expected owner IDs encode the intended lexical tree independently of ownerKey's decoding.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary nested dot syntax contrasts bracketed dotted, empty and escaped keys; literal bracket text contrasts a real nested empty member. Namespace-prefixed variables and legacy class literal bracket names retain their actual owners.
 * @evidence contracts/testing.md#execution-ownership Runs actual graph memory synthesis against in-memory producer facts in the unit process; native producer extraction is covered by the owning Go case and shared graph E2E.
 */
export function test_ttscgraph_memory_keeps_bracketed_object_members_distinct(): void {
  const rows = [
    ["api", "api", "variable", undefined],
    ["api.quoted", "quoted", "variable", "api"],
    ["api.quoted.key", "key", "method", "api.quoted"],
    ['api["quoted.key"]', "quoted.key", "method", "api"],
    ['api[""]', "", "method", "api"],
    ['api["esc\\\".\\u2028"]', 'esc".\u2028', "method", "api"],
    ['api["a[\\\"\\\"]"]', 'a[""]', "method", "api"],
    ["api.a", "a", "variable", "api"],
    ['api.a[""]', "", "method", "api.a"],
    ["Names.api", "api", "variable", undefined],
    ['Names.api["["]', "[", "method", "Names.api"],
    ["Control", "Control", "class", undefined],
    ['Control.a[""]', 'a[""]', "method", "Control"],
  ] as const;
  const nodes: ResolverGraphNode[] = rows.map(
    ([qualifiedName, name, kind]) => ({
      id: `src/object.ts#${qualifiedName}:${kind}`,
      kind,
      name,
      qualifiedName,
      file: "src/object.ts",
      external: false,
    }),
  );
  const graph = createSyntheticGraph(nodes);
  assert.equal(graph.nodes.filter((node) => node.kind === "method").length, 8);
  for (const [qualified, , kind, owner] of rows) {
    if (owner === undefined) continue;
    const id = `src/object.ts#${qualified}:${kind}`;
    assert.deepEqual(
      graph
        .incoming(id)
        .filter((edge) => edge.kind === "contains")
        .map((edge) => edge.from),
      [`src/object.ts#${owner}:${owner === "Control" ? "class" : "variable"}`],
    );
  }
}
