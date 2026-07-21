import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtsgraphClient, assert } from "../internal/ttsgraph";

interface ToolResult {
  structuredContent?: unknown;
}

interface DetailsResult {
  type: "details";
  nodes: { name: string; signature?: string; doc?: string }[];
}

const graphArguments = (handles: string[]) => ({
  question: "Inspect declaration signatures from the current source snapshot.",
  draft: {
    reason: "The named declarations need one precise graph details request.",
    type: "details",
  },
  review:
    "Confirmed: the graph details answer is the needed source-derived fact.",
  request: { type: "details", handles },
});

const detailsOf = (result: ToolResult): DetailsResult => {
  const value = (result.structuredContent ?? {}) as { result?: DetailsResult };
  if (value.result?.type !== "details")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};

const utf16be = (text: string): Buffer =>
  Buffer.concat([
    Buffer.from([0xfe, 0xff]),
    Buffer.from(text, "utf16le").swap16(),
  ]);

/**
 * Verifies graph details preserves display facts for BOM and UTF-16 sources.
 *
 * The native snapshot hashes raw on-disk bytes separately from the decoded
 * source text that its checker parsed. The Node reader must prove both domains
 * before it slices declarations. Otherwise ordinary Windows-generated files
 * fail the checker-digest gate forever and details silently drops signatures
 * and docs.
 *
 * 1. Materialize equivalent exported functions as UTF-8 BOM, UTF-16LE, and
 *    UTF-16BE files.
 * 2. Ask the real resident `ttscgraph` server for all three declaration details.
 * 3. Assert each result carries its compiler-aligned signature head and doc.
 */
export const test_ttscgraph_details_reads_bom_and_utf16_source_snapshot =
  async () => {
    const source = (name: string) =>
      [
        `/** ${name} docs. */`,
        `export function ${name}(): string {`,
        `  return "${name}";`,
        "}",
        "",
      ].join("\n");
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { target: "ES2022", module: "commonjs", strict: true },
        include: ["src"],
      }),
      "src/Utf8Bom.ts": "",
      "src/Utf16Le.ts": "",
      "src/Utf16Be.ts": "",
    });
    fs.writeFileSync(
      path.join(root, "src", "Utf8Bom.ts"),
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(source("Utf8Bom")),
      ]),
    );
    fs.writeFileSync(
      path.join(root, "src", "Utf16Le.ts"),
      Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(source("Utf16Le"), "utf16le"),
      ]),
    );
    fs.writeFileSync(
      path.join(root, "src", "Utf16Be.ts"),
      utf16be(source("Utf16Be")),
    );

    const names = ["Utf8Bom", "Utf16Le", "Utf16Be"];
    const client = TtsgraphClient.start(root);
    try {
      await client.request("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test-graph", version: "0.0.0" },
      });
      client.notify("notifications/initialized", {});

      const details = detailsOf(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments(names),
        })) as ToolResult,
      );
      for (const name of names) {
        const node = details.nodes.find((candidate) => candidate.name === name);
        assert.ok(node, `details resolves ${name}: ${JSON.stringify(details)}`);
        // The head, and only the head. This assertion used to require the
        // body's opening `{` to be present, which recorded the line-scan leak
        // #814 removed: a signature is now cut where the compiler says the body
        // opens. The decoding this test is about is proven by the head arriving
        // intact from a BOM / UTF-16 source, not by how much of the body rides
        // along with it.
        assert.equal(
          node.signature,
          `export function ${name}(): string`,
          `details keeps ${name}'s signature: ${JSON.stringify(node)}`,
        );
        assert.equal(
          node.doc,
          `${name} docs.`,
          `details keeps ${name}'s doc: ${JSON.stringify(node)}`,
        );
      }
    } finally {
      client.endStdin();
      const code = await client.waitForExit();
      assert.equal(code, 0, client.stderrText());
    }
  };
