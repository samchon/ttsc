import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const graphLib = path.dirname(require.resolve("@ttsc/graph"));
const { TtscGraphMemory } = require(
  path.join(graphLib, "model", "TtscGraphMemory.js"),
) as { TtscGraphMemory: { from(dump: unknown): GraphMemory } };
const { runLookup } = require(
  path.join(graphLib, "server", "runLookup.js"),
) as {
  runLookup(
    graph: GraphMemory,
    props: { query: string },
  ): { result: { hits: { id: string; kind: string; name: string }[] } };
};
const { TTSC_GRAPH_ARTIFACT_NODE_KINDS } = require(
  path.join(graphLib, "structures", "TtscGraphArtifactNodeKind.js"),
) as { TTSC_GRAPH_ARTIFACT_NODE_KINDS: readonly string[] };

interface GraphMemory {
  node(id: string): { id: string; kind: string; parent?: string } | undefined;
  incoming(id: string): readonly { from: string; to: string; kind: string }[];
}

/**
 * A dump carrying one declaration, the section it cites, and that section's
 * document.
 */
const dump = () => ({
  project: "/fixture",
  tsconfig: "tsconfig.json",
  provenance: {
    schemaVersion: 8,
    capabilities: ["docTags", "artifactNodes"],
    producer: { tool: "fixture", typescript: "7.0.0-dev" },
    artifactProducer: { tool: "fixture lint" },
    universe: { configs: [], roots: [] },
    sources: [],
  },
  diagnostics: [],
  nodes: [
    {
      id: "src/notice.ts#renderNotice:function",
      kind: "function",
      name: "renderNotice",
      file: "src/notice.ts",
      external: false,
      docTags: [{ name: "evidence", text: "docs/sale.md#pricing Why." }],
      evidence: { startLine: 3 },
    },
    {
      id: "src/price.ts#price:function",
      kind: "function",
      name: "price",
      file: "src/price.ts",
      external: false,
      exported: true,
      evidence: { startLine: 1 },
    },
    {
      id: "docs/sale.md",
      kind: "markdown_document",
      name: "Sale",
      file: "docs/sale.md",
      external: false,
      evidence: { startLine: 1 },
    },
    {
      id: "docs/sale.md#pricing",
      kind: "markdown_section",
      name: "Pricing",
      file: "docs/sale.md",
      external: false,
      parent: "docs/sale.md",
      evidence: { startLine: 7 },
    },
  ],
  edges: [
    {
      from: "src/notice.ts#renderNotice:function",
      to: "docs/sale.md#pricing",
      kind: "doc_ref",
    },
    {
      from: "src/notice.ts#renderNotice:function",
      to: "src/price.ts#price:function",
      kind: "calls",
    },
  ],
});

/**
 * Verifies artifact nodes: a citation resolves to what it names, and a tour is
 * never seeded by one.
 *
 * The reverse question worked before an artifact was a node: a lookup on an
 * address answered with the declarations citing it. What it could not answer is
 * what the address names, which is the concrete loss an index exists to remove
 * — so the artifact now leads its own answer, carrying the heading text and the
 * line that heading starts on, never the section's content.
 *
 * The tour is the negative half, and it is the one a closed seed set makes easy
 * to lose: a tour is asked what the project is and how it runs, and a document
 * section is neither. Nothing stops someone widening `TOUR_SEED_KINDS`, so the
 * outcome is pinned here rather than left to that set's current contents.
 *
 * 1. Build a memory over a dump carrying a declaration, the section it cites, and
 *    that section's document.
 * 2. Assert containment was synthesized from `parent`, not from a `file` node.
 * 3. Assert a lookup on the address returns the artifact and the citing
 *    declaration, and that a tour selects neither artifact.
 */
export const test_ttscgraph_artifact_nodes_answer_and_never_seed_a_tour =
  (): void => {
    const graph = TtscGraphMemory.from(dump());

    const section = graph.node("docs/sale.md#pricing");
    assert.notEqual(section, undefined, "the section is not in the memory");
    const contains = graph
      .incoming(section!.id)
      .filter((edge) => edge.kind === "contains");
    assert.deepEqual(
      contains.map((edge) => edge.from),
      ["docs/sale.md"],
      "a section is contained by its document, never by a synthesized file node",
    );

    const hits = runLookup(graph, { query: "docs/sale.md#pricing" }).result
      .hits;
    assert.equal(
      hits[0]?.id,
      "docs/sale.md#pricing",
      "the artifact does not lead the answer to its own address",
    );
    assert.equal(
      hits[0]?.name,
      "Pricing",
      "the artifact answered without the heading text it exists to carry",
    );
    assert.ok(
      hits.some((hit) => hit.id === "src/notice.ts#renderNotice:function"),
      "the declaration citing the address is missing from the answer",
    );

    // The sidecar finds its own configured rules in the manifest, so a verb
    // invoked without one loads an empty configuration and answers `[]` — for
    // every project, indistinguishable from one that publishes nothing. It
    // shipped that way once. Nothing observable from here can tell the two
    // apart, so the invocation itself is what is pinned.
    const launcher = fs.readFileSync(
      path.join(
        path.resolve(graphLib, "..", "..", ".."),
        "packages/graph/src/model/publishedArtifacts.ts",
      ),
      "utf8",
    );
    assert.ok(
      /--plugins-json=\$\{plugin\.manifest\}/.test(launcher),
      "the artifact verb is invoked without the manifest that carries the project's rules",
    );

    // The tour half is a source-level claim, not a run. A synthetic dump cannot
    // be made to seed a tour without also fabricating the entrypoint and degree
    // conditions a seed depends on, and a tour that selected nothing would pass
    // a case written to prove what a tour does not select — the vacuous form.
    // What is actually invariant is the seed set: a tour is asked what the
    // project is and how it runs, and a document section is neither.
    const seeds = /const TOUR_SEED_KINDS = new Set<[^>]*>\(\[([^\]]*)\]/.exec(
      fs.readFileSync(
        path.join(
          path.dirname(require.resolve("@ttsc/graph/package.json")),
          "src",
          "server",
          "runTour.ts",
        ),
        "utf8",
      ),
    );
    assert.notEqual(seeds, null, "runTour no longer declares a seed-kind set");
    for (const kind of TTSC_GRAPH_ARTIFACT_NODE_KINDS)
      assert.equal(
        seeds![1]!.includes(`"${kind}"`),
        false,
        `${kind} seeds a tour; a tour is asked what the project is and how it runs`,
      );
  };
