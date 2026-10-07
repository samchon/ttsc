import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscGraphMemory } from "../../../../packages/graph/src/model/TtscGraphMemory";
import { runDetails } from "../../../../packages/graph/src/server/runDetails";
import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";
import { TestProject } from "../../../utils/src/TestProject";

/** The heading text a section carries, and the prose it must never carry. */
const HEADING = "Coupon stacking";
const BODY = "Only one coupon per issuer may apply to a single order line.";

const dump = (): ITtscGraphDump => ({
  project: "/fixture",
  tsconfig: "tsconfig.json",
  provenance: {
    schemaVersion: 8,
    capabilities: ["artifactNodes", "sourceDigests"],
    producer: { tool: "fixture", version: "", typescript: "7.0.0-dev" },
    artifactProducer: { tool: "fixture lint", version: "", typescript: "" },
    universe: { configs: [], roots: [] },
    // The document is deliberately absent from the manifest: a plugin read it,
    // this Program did not, so the reader has no digest to trust and must fail
    // closed rather than reach for the file.
    sources: [],
  },
  diagnostics: [],
  nodes: [
    {
      id: "docs/discount.md#coupon-stacking",
      kind: "markdown_section",
      name: HEADING,
      file: "docs/discount.md",
      external: false,
      parent: "docs/discount.md",
      evidence: { startLine: 12 },
    },
    {
      id: "docs/discount.md",
      kind: "markdown_document",
      name: "Discount",
      file: "docs/discount.md",
      external: false,
      evidence: { startLine: 1 },
    },
  ],
  edges: [],
});

/**
 * Verifies `details` answers an artifact with its name and span and never with
 * its content.
 *
 * The graph is an index with spans, and that rule is what keeps a large project
 * from turning one tool call into a prompt full of prose. A Markdown section is
 * prose from its heading to the next one, so "return the span, not the text" is
 * the only thing standing between an index and a document dump.
 *
 * It holds today because the source reader is fail-closed: a file the compiler
 * never loaded has no digest, so nothing can be sliced out of it. That is a
 * property of a different module, which is why it is asserted here.
 *
 * 1. Write a Markdown file containing the heading and a body sentence, and build a
 *    memory over a dump whose section node points at it with no source digest.
 * 2. Ask `details` for the section by its address.
 * 3. Assert it answers with the heading and the line, that no serialized field
 *    contains the body sentence, and that no members are listed.
 *
 * @evidence contracts/testing.md#behavioral-verification runDetails over a TtscGraphMemory whose project is a temporary directory holding docs/discount.md must answer the handle "docs/discount.md#coupon-stacking" with name "Coupon stacking" and sourceSpan.startLine 12, with the JSON of the whole answer not containing the body sentence and with no members.
 * @evidence contracts/testing.md#independent-expectations The heading text, the line 12 (eleven preamble lines precede the heading in the file the test writes) and the body sentence are literals authored by the test; the check searches the serialized answer, so a body leaking through any field would be found.
 * @evidence contracts/testing.md#distinguishing-cases The document exists on disk and contains the body, but the dump's source manifest is empty so the reader has no digest to trust; the heading and span must be returned while the prose and any invented members must not. A dump that does list the document's digest is not exercised.
 * @evidence contracts/testing.md#execution-ownership Calls TtscGraphMemory.from and runDetails in the test process over a real temporary directory holding the Markdown file; no consumer is installed and no native producer or host is started.
 */
export function test_ttscgraph_details_never_returns_an_artifact_body(): void {
  const directory = TestProject.tmpdir("graph-artifact-prose-");
  try {
    fs.mkdirSync(path.join(directory, "docs"));
    fs.writeFileSync(
      path.join(directory, "docs/discount.md"),
      Array(11).fill("preamble").join("\n") +
        "\n## " +
        HEADING +
        "\n" +
        BODY +
        "\n",
    );
    const snapshot = dump();
    snapshot.project = directory;
    const graph = TtscGraphMemory.from(snapshot);
    const detail = runDetails(graph, {
      type: "details",
      handles: ["docs/discount.md#coupon-stacking"],
    }).result.nodes[0];

    assert.notEqual(
      detail,
      undefined,
      "details answered nothing for a node it holds",
    );
    assert.equal(
      detail!.name,
      HEADING,
      "details answered without the heading text an index exists to carry",
    );
    assert.equal(
      detail!.sourceSpan?.startLine,
      12,
      "details answered without the line the heading starts on",
    );

    // Every field that could carry text, checked as one: a body reaching the
    // answer through `signature` and through `doc` is the same defect, and a
    // future field would be too.
    const serialized = JSON.stringify(detail);
    assert.equal(
      serialized.includes(BODY),
      false,
      `details returned the section's prose: ${serialized}`,
    );
    assert.equal(
      detail!.members === undefined || detail!.members.length === 0,
      true,
      "an artifact has no members; a member list here would be invented",
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
