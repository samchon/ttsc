import assert from "node:assert/strict";

import { reduce } from "../../../../packages/graph/src/reduce";

/**
 * Verifies the view reducer drops git-ignored generated code and external
 * leaves by default and keeps ignored code on request.
 *
 * The viewer shows the authored graph, so a node flagged ignored (generated
 * code) or external is dropped with its edges, and counted, unless the
 * keepIgnored option asks otherwise.
 *
 * 1. Reduce a dump holding an authored node, a git-ignored generated node and an
 *    external leaf, with the authored node calling both.
 * 2. Require no surviving node (the authored node loses both of its edges) and the
 *    ignored and external drop counts of one each.
 * 3. Reduce with keepIgnored and require the authored and generated nodes to
 *    survive and no ignored drop.
 *
 * @evidence contracts/testing.md#behavioral-verification reduce of the three-node dump must return no nodes, with counts.droppedIgnored 1 and counts.droppedExternal 1; reduce with keepIgnored: true must return node ids ["a", "g"] (which requires the a-to-g edge to survive) and counts.droppedIgnored 0.
 * @evidence contracts/testing.md#independent-expectations The node ids, the ignored and external flags, the edge list and the expected counts and surviving ids are literals written in the test from the stated contract that the viewer shows authored connected code by default.
 * @evidence contracts/testing.md#distinguishing-cases The ignored and external nodes are separate drops with separate counters, the authored node is itself removed because it becomes isolated, and keepIgnored false versus true contrasts the two policies. keepExternal and the degree cap are not exercised, and only the package reducer is run in this test.
 * @evidence contracts/testing.md#execution-ownership Calls the pure reduce function from packages/graph in the test process with an in-memory dump; no installed artifact, native build or product process is involved.
 */
export function test_ttscgraph_view_payload_drops_git_ignored_generated_code(): void {
  const raw = {
    project: "fixture",
    nodes: [
      { id: "a", name: "authored", kind: "function", file: "src/a.ts" },
      {
        id: "g",
        name: "generated",
        kind: "function",
        file: "src/generated/client.ts",
        ignored: true,
      },
      {
        id: "e",
        name: "external",
        kind: "function",
        file: "node_modules/x/index.d.ts",
        external: true,
      },
    ],
    edges: [
      { from: "a", to: "g", kind: "calls" },
      { from: "a", to: "e", kind: "calls" },
    ],
  };

  const payload = reduce(raw);
  assert.deepEqual(
    payload.nodes.map((n) => n.id),
    [],
    "with its only edges pointing at dropped nodes the authored node has degree zero",
  );
  assert.equal(payload.counts.droppedIgnored, 1);
  assert.equal(payload.counts.droppedExternal, 1);

  const kept = reduce(raw, { keepIgnored: true });
  assert.deepEqual(
    kept.nodes.map((n) => n.id).sort(),
    ["a", "g"],
    "keepIgnored restores the generated node and the edge to it",
  );
  assert.equal(kept.counts.droppedIgnored, 0);
}
