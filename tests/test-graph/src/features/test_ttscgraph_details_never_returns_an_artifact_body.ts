import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const graphLib = path.dirname(require.resolve("@ttsc/graph"));
const { TtscGraphMemory } = require(
  path.join(graphLib, "model", "TtscGraphMemory.js"),
) as { TtscGraphMemory: { from(dump: unknown): unknown } };
const { runDetails } = require(
  path.join(graphLib, "server", "runDetails.js"),
) as {
  runDetails(
    graph: unknown,
    props: { handles: string[] },
  ): {
    result: {
      nodes: {
        name: string;
        signature?: string;
        doc?: string;
        sourceSpan?: { startLine?: number };
        members?: unknown[];
      }[];
    };
  };
};

/** The heading text a section carries, and the prose it must never carry. */
const HEADING = "Coupon stacking";
const BODY = "Only one coupon per issuer may apply to a single order line.";

const dump = () => ({
  project: "/fixture",
  tsconfig: "tsconfig.json",
  provenance: {
    schemaVersion: 8,
    capabilities: ["artifactNodes", "sourceDigests"],
    producer: { tool: "fixture", typescript: "7.0.0-dev" },
    artifactProducer: { tool: "fixture lint" },
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
 * from turning one tool call into a prompt full of prose. A declaration is safe
 * by construction — the producer renders a signature and cuts it where the
 * compiler says the body opens — but an artifact has no such producer-side cut:
 * a Markdown section is prose from its heading to the next one, so "return the
 * span, not the text" is the only thing standing between an index and a
 * document dump.
 *
 * It holds today because the source reader is fail-closed: a file the compiler
 * never loaded has no digest, so nothing can be sliced out of it. That is a
 * property of a different module, which is exactly why it is asserted here —
 * loosening that fallback would inline a document with nothing else objecting.
 *
 * 1. Build a memory over a dump carrying a section whose file the manifest does
 *    not describe.
 * 2. Ask `details` for the section by its address.
 * 3. Assert it answers with the heading and the line, and that no field carries
 *    the document's prose.
 */
export const test_ttscgraph_details_never_returns_an_artifact_body =
  (): void => {
    const graph = TtscGraphMemory.from(dump());
    const detail = runDetails(graph, {
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
  };
