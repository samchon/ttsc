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
 * 1. Build a class and its quoted dotted variable from a synthetic dump.
 * 2. Let the real memory synthesis refine containment and property kind.
 * 3. Assert the class owns the refined property.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphMemory.from refines the dotted quoted member and synthesizes containment under Box, not Box.a.
 * @evidence contracts/testing.md#independent-expectations The authored simple name a.b belongs to Box; its dot is identifier data.
 * @evidence contracts/testing.md#distinguishing-cases A class and one dotted-name variable distinguish exact member suffix ownership from a last-dot split.
 * @evidence contracts/testing.md#execution-ownership The named exported src/unit entry executes authored graph memory and resolver through the unit loader; no installed consumer, native producer or child process is used.
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
