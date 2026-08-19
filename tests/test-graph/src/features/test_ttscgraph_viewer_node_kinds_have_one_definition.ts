import assert from "node:assert/strict";

import {
  dumpVocabulary,
  readStringConstant,
  readStringList,
  readStringMap,
  repositoryRoot,
} from "../internal/viewerDisplay";

/**
 * Verifies graph viewer: one definition of the node kinds.
 *
 * The edge families got this treatment first; the node kinds had the same gap
 * and a worse symptom. `module` was absent from both viewers' colour maps and
 * from the website's chip order, and because the unknown-kind fallback was
 * spelled with `variable`'s own colour, a module node was not drawn as
 * unrecognized — it was drawn as a variable. A dump carries module nodes
 * whenever it carries an `exports` edge, which is every dump.
 *
 * 1. Read the node vocabulary from `TtscGraphDumpNodeKind`.
 * 2. Assert both viewers colour every kind of it, and that the website's chip
 *    order names the same set.
 * 3. Assert each viewer's unknown-kind fallback is a colour no kind uses, so
 *    "unknown" stays distinguishable from every named kind.
 */
export const test_ttscgraph_viewer_node_kinds_have_one_definition =
  async (): Promise<void> => {
    const root = repositoryRoot();
    const kinds = dumpVocabulary(
      root,
      "packages/graph/src/structures/TtscGraphDumpNodeKind.ts",
      "TtscGraphDumpNodeKind",
    );
    assert.ok(kinds.includes("module"), "the dump vocabulary lost `module`");

    const bundled = readStringMap(
      root,
      "packages/graph/src/viewer/legend.ts",
      "NODE_COLORS",
    );
    const website = readStringMap(
      root,
      "website/src/components/graph/TtscWebsiteGraphViewerModel.ts",
      "NODE_COLORS",
    );

    for (const [surface, map] of [
      ["packages/graph/src/viewer/legend.ts NODE_COLORS", bundled],
      ["TtscWebsiteGraphViewerModel NODE_COLORS", website],
    ] as const)
      assert.deepEqual(
        Object.keys(map).sort(),
        [...kinds].sort(),
        `${surface} does not colour exactly the node kinds a dump can carry`,
      );

    // The chip order is a third surface over the same vocabulary: a kind absent
    // from it has no filter row, whatever colour it was given.
    const order = readStringList(
      root,
      "website/src/components/graph/TtscWebsiteGraphViewerModel.ts",
      "NODE_KIND_ORDER",
    );
    assert.deepEqual(
      [...order].sort(),
      [...kinds].sort(),
      "NODE_KIND_ORDER does not name exactly the node kinds a dump can carry",
    );

    // The negative twin, and the reason a module read as a variable: a fallback
    // that equals a named kind's colour cannot mean "unknown".
    for (const [surface, map, fallback] of [
      [
        "packages/graph/src/viewer/legend.ts",
        bundled,
        readStringConstant(
          root,
          "packages/graph/src/viewer/legend.ts",
          "UNKNOWN_NODE_COLOR",
        ),
      ],
      [
        "TtscWebsiteGraphViewerModel",
        website,
        readStringConstant(
          root,
          "website/src/components/graph/TtscWebsiteGraphViewerModel.ts",
          "UNKNOWN_NODE_COLOR",
        ),
      ],
    ] as const) {
      const named = Object.entries(map).filter(
        ([, color]) => color === fallback,
      );
      assert.deepEqual(
        named,
        [],
        `${surface}: the unknown-node colour ${fallback} is also ${named
          .map(([kind]) => kind)
          .join(", ")}, so an unrecognized kind is drawn as that kind`,
      );
    }

    // Every named kind is its own colour, so the picture stays injective.
    for (const [surface, map] of [
      ["packages/graph/src/viewer/legend.ts", bundled],
      ["TtscWebsiteGraphViewerModel", website],
    ] as const)
      assert.equal(
        new Set(Object.values(map)).size,
        Object.keys(map).length,
        `${surface}: two node kinds share a colour, so they cannot be told apart`,
      );
  };
