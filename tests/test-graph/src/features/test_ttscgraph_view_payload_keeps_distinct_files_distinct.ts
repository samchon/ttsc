import { reduce } from "../../../../packages/graph/src/reduce";

import assert from "node:assert/strict";

/**
 * Verifies the viewer projection keeps two distinct files distinct.
 *
 * The reduction rewrites node ids with the display path it computes, so a
 * non-injective projection does not merely mislabel — two declarations in two
 * files become one node, and an edge drawn between them resolves back to the
 * wrong end. The old fallback collapsed anything outside the common root to its
 * basename, which two shapes reach: disjoint absolute roots, and the mixed path
 * forms one valid project can emit, where the common root comes out empty and
 * every relative file falls through to its basename.
 *
 * 1. Reduce a dump whose two files share a basename under disjoint roots.
 * 2. Reduce a dump mixing an absolute file with two relative ones sharing a
 *    basename.
 * 3. Assert both keep two nodes with distinct ids and a resolvable edge.
 *
 * @evidence contracts/testing.md#behavioral-verification reduce preserves distinct node identities and the connecting edge for disjoint and mixed path inputs.
 * @evidence contracts/testing.md#independent-expectations Distinct authored file paths identify distinct declarations; equal basenames must not merge them.
 * @evidence contracts/testing.md#distinguishing-cases Disjoint absolute roots and mixed absolute/relative paths with repeated basenames distinguish injective projection from basename collapse.
 * @evidence contracts/testing.md#execution-ownership The named exported src/features entry calls authored operations through the unit loader; fixtures are in-memory and no installed artifact, native build or product process is needed.
 */
export function test_ttscgraph_view_payload_keeps_distinct_files_distinct(): void {
    const disjoint = reduce({
      project: "disjoint",
      nodes: [
        {
          id: "/a/foo.ts#same:function",
          name: "same",
          kind: "function",
          file: "/a/foo.ts",
        },
        {
          id: "/b/foo.ts#same:function",
          name: "same",
          kind: "function",
          file: "/b/foo.ts",
        },
      ],
      edges: [
        {
          from: "/a/foo.ts#same:function",
          to: "/b/foo.ts#same:function",
          kind: "calls",
        },
      ],
    });
    assert.equal(new Set(disjoint.nodes.map((n) => n.id)).size, 2);
    assert.equal(disjoint.links.length, 1);
    assert.deepEqual(disjoint.links.map(({ source, target }) => [source, target]), [
      ["/a/foo.ts#same:function", "/b/foo.ts#same:function"],
    ]);

    const mixed = reduce({
      project: "mixed",
      nodes: [
        {
          id: "/out/lib.ts#lib:function",
          name: "lib",
          kind: "function",
          file: "/out/lib.ts",
        },
        {
          id: "src/main.ts#main:function",
          name: "main",
          kind: "function",
          file: "src/main.ts",
        },
        {
          id: "src/nested/main.ts#nested:function",
          name: "nested",
          kind: "function",
          file: "src/nested/main.ts",
        },
      ],
      edges: [
        {
          from: "src/main.ts#main:function",
          to: "src/nested/main.ts#nested:function",
          kind: "calls",
        },
      ],
    });
    const files = mixed.nodes.map((n) => n.file);
    assert.equal(mixed.nodes.length, 2, "both connected relative files survive");
    assert.equal(
      new Set(mixed.nodes.map((n) => n.id)).size,
      mixed.nodes.length,
      `viewer ids collided: ${JSON.stringify(files)}`,
    );
    assert.equal(mixed.links.length, 1);
    assert.deepEqual(mixed.links.map(({ source, target }) => [source, target]), [
      ["src/main.ts#main:function", "src/nested/main.ts#nested:function"],
    ]);
    for (const payload of [disjoint, mixed]) {
      const ids = new Set(payload.nodes.map((node) => node.id));
      for (const link of payload.links) {
        assert.ok(ids.has(link.source));
        assert.ok(ids.has(link.target));
      }
    }
}
