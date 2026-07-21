import { reduce } from "@ttsc/graph";

import { assert } from "../internal/ttsgraph";

/**
 * Verifies the `view` reducer drops git-ignored generated code, as the guide
 * and the producer both promise.
 *
 * `packages/ttsc/internal/graph/gitignore.go` says "the full-graph dump drops
 * them from the viewer payload entirely" and the shipped viewer guide lists
 * "Git-ignored generated code is dropped" under what is left out. Both sibling
 * copies of this pure transform applied the filter; this one declared no
 * `ignored` field at all, so `ttsc-graph view` rendered a project's Prisma
 * client while the same dump uploaded to the website did not.
 *
 * The node cap makes the omission worse rather than containing it: the payload
 * is capped by degree, and generated clients are large and densely connected,
 * so they outrank authored code for the surviving slots.
 *
 * 1. Reduce a dump holding an authored node, a git-ignored generated node, and an
 *    external leaf.
 * 2. Assert only the authored node survives and the counts attribute each drop.
 * 3. Assert `keepIgnored` brings the generated node back, so the filter is a
 *    policy rather than a hard exclusion.
 */
export const test_ttscgraph_view_payload_drops_git_ignored_generated_code =
  (): void => {
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
          kind: "external_symbol",
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
  };
