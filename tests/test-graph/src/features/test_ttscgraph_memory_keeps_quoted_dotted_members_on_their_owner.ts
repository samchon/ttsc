import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  createSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies graph memory ownership: a quoted dotted member remains on its
 * declaring class.
 *
 * The producer sends `name` and `qualifiedName` separately because the dot in
 * `a.b` belongs to the member. Deriving an owner by cutting the qualified name
 * at its final dot invents `Box.a`; the exact simple-name suffix identifies
 * `Box` instead.
 *
 * 1. Build a class Box and a variable named "a.b" (qualified Box.a.b) from a
 *    synthetic dump.
 * 2. Let TtscGraphMemory.from refine containment and the member kind.
 * 3. Assert the member became a property and Box contains it.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphMemory.from over a class Box and a variable with name "a.b" and qualifiedName "Box.a.b" must refine the variable's kind to "property" and give it a contains edge from Box.
 * @evidence contracts/testing.md#independent-expectations The fixture authors the simple name "a.b" and the qualified name "Box.a.b" as separate fields and the expected owner id "src/box.ts#Box:class" as a literal; the dot in the name is data, not a separator.
 * @evidence contracts/testing.md#distinguishing-cases A last-dot split of the qualified name would look for an owner "Box.a", find none, and leave the member kind a variable under the file; the assertions on kind and contains owner exclude that. Only one member and one owner are used, and a same-named member of another class is not covered.
 * @evidence contracts/testing.md#execution-ownership Calls TtscGraphMemory.from through createSyntheticGraph in the test process with typed in-memory nodes; no resolver call is made, and no native producer or process is involved.
 */
export function test_ttscgraph_memory_keeps_quoted_dotted_members_on_their_owner(): void {
  const box: ResolverGraphNode = {
    id: "src/box.ts#Box:class",
    kind: "class",
    name: "Box",
    file: "src/box.ts",
    external: false,
  };
  const member: ResolverGraphNode = {
    id: "src/box.ts#Box.a.b:variable",
    kind: "variable",
    name: "a.b",
    qualifiedName: "Box.a.b",
    file: "src/box.ts",
    external: false,
  };
  const graph = createSyntheticGraph([box, member]);
  const property = graph.nodes.find((node) => node.id === member.id);
  assert.strictEqual(property?.kind, "property");
  assert.ok(
    graph
      .incoming(member.id)
      .some((edge) => edge.kind === "contains" && edge.from === box.id),
  );
}
