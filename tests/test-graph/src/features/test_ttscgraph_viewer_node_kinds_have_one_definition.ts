import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

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
/** The node kinds that are TypeScript declarations rather than artifacts. */
const DECLARATION_KINDS = new Set([
  "function",
  "class",
  "interface",
  "type",
  "enum",
  "variable",
  "method",
]);

/** Every `"markdown_*"`, `"prisma_*"`, or `"swagger_*"` literal in a source. */
const quotedArtifactKinds = (source: string): string[] =>
  [
    ...new Set(
      [...source.matchAll(/"((?:markdown|prisma|swagger)_[a-z]+)"/g)].map(
        (match) => match[1]!,
      ),
    ),
  ].sort();

const readSource = (root: string, file: string): string =>
  fs.readFileSync(path.join(root, file), "utf8");

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

    // The constants have to be what the call sites actually read. Asserting the
    // declaration alone leaves #1256 restorable green: replacing
    // `?? UNKNOWN_NODE_COLOR` with the old `?? "#64748b"` literal in the scene,
    // or `?? "#8b97a8"` in the bundled viewer, is exactly "a module is drawn as
    // a variable" and changes no declaration.
    for (const file of [
      "packages/graph/src/viewer/main.ts",
      "website/src/components/graph/TtscWebsiteGraphViewerScene.ts",
      "website/src/components/graph/TtscWebsiteGraphViewer3D.tsx",
      "website/src/components/graph/TtscWebsiteGraphViewerSidebar.tsx",
    ]) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      const literal = /(?:NODE_COLORS|LINK_COLORS)\[[^\]]*\]\s*\?\?\s*"#/.exec(
        source,
      );
      assert.equal(
        literal,
        null,
        `${file} spells a fallback colour as a literal beside a colour map; it has to read the shared constant`,
      );
    }

    // The artifact half of the vocabulary is spelled in three places across two
    // Go modules and one TypeScript package, because none of them may import
    // another: the rule API publishes it, the compiler host accepts it, and the
    // consumer gates its id parser on it. Nothing but this holds them together,
    // and the failure mode is the quiet one — a kind a rule publishes and the
    // host does not map is dropped, by declared design, so the feature simply
    // stops working for that kind with no error anywhere. This pull request
    // exists because a vocabulary agreed by hand always drifts.
    const artifactVocabularies: [string, string[]][] = [
      [
        "packages/lint/rule/graph.go",
        quotedArtifactKinds(readSource(root, "packages/lint/rule/graph.go")),
      ],
      [
        "packages/ttsc/internal/graph/artifacts.go",
        quotedArtifactKinds(
          readSource(root, "packages/ttsc/internal/graph/artifacts.go"),
        ),
      ],
      [
        "packages/graph/src/structures/TtscGraphArtifactNodeKind.ts",
        quotedArtifactKinds(
          readSource(
            root,
            "packages/graph/src/structures/TtscGraphArtifactNodeKind.ts",
          ),
        ),
      ],
    ];
    const artifactKinds = kinds
      .filter((kind) => kind !== "module" && !DECLARATION_KINDS.has(kind))
      .sort();
    assert.ok(
      artifactKinds.length > 0,
      "the dump vocabulary carries no artifact kind; this case would prove nothing",
    );
    for (const [file, spelled] of artifactVocabularies)
      assert.deepEqual(
        spelled,
        artifactKinds,
        `${file} does not spell exactly the artifact kinds a dump can carry`,
      );

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
