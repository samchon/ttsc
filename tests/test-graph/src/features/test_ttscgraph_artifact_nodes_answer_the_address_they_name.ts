import assert from "node:assert/strict";

import { TtscGraphMemory } from "../../../../packages/graph/src/model/TtscGraphMemory";
import { runLookup } from "../../../../packages/graph/src/server/runLookup";
import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";

/**
 * A dump carrying one declaration, the section it cites, and that section's
 * document.
 */
const dump = (): ITtscGraphDump => ({
  project: "/fixture",
  tsconfig: "tsconfig.json",
  provenance: {
    schemaVersion: 8,
    capabilities: ["docTags", "artifactNodes"],
    producer: { tool: "fixture", version: "", typescript: "7.0.0-dev" },
    artifactProducer: { tool: "fixture lint", version: "", typescript: "" },
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
 * Verifies artifact nodes: a citation resolves to what it names.
 *
 * The reverse question worked before an artifact was a node: a lookup on an
 * address answered with the declarations citing it. What it could not answer is
 * what the address names, which is the concrete loss an index exists to remove
 * — so the artifact now leads its own answer, carrying the heading text and the
 * line that heading starts on, never the section's content.
 *
 * 1. Build a memory over a dump carrying a declaration, the section it cites, and
 *    that section's document.
 * 2. Assert containment was synthesized from `parent`, not from a `file` node.
 * 3. Assert a lookup on the address returns the artifact and the citing
 *    declaration.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphMemory.from must synthesize a contains edge from the section's parent document, and runLookup on "docs/sale.md#pricing" must return the section first, named "Pricing", with the citing declaration renderNotice also among the hits. The section body is not part of the dump and the test does not assert its absence.
 * @evidence contracts/testing.md#independent-expectations The expected ids ("docs/sale.md", "docs/sale.md#pricing", "src/notice.ts#renderNotice:function") and the title "Pricing" are literals authored in the dump fixture, not computed by the memory or lookup indexes.
 * @evidence contracts/testing.md#distinguishing-cases The incoming contains edges must be exactly [docs/sale.md], excluding a file-node or missing parent. Lookup returns the addressed section first and its citing renderNotice declaration while excluding the unrelated price calls target, so a code dependency cannot masquerade as a citation.
 * @evidence contracts/testing.md#execution-ownership The named src/features entry invokes authored memory and lookup functions on deliberately synthetic index data without installed artifacts, native builds or a host.
 */
export function test_ttscgraph_artifact_nodes_answer_the_address_they_name(): void {
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

  const hits = runLookup(graph, {
    type: "lookup",
    query: "docs/sale.md#pricing",
  }).result.hits;
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
  assert.equal(
    hits.some((hit) => hit.id === "src/price.ts#price:function"),
    false,
    "an unrelated code dependency is not a citation to the artifact",
  );
}
