import fs from "node:fs";
import path from "node:path";

import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

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

/**
 * Verifies graph details preserves display facts across source encodings and
 * ECMAScript line terminators.
 *
 * The native snapshot hashes raw on-disk bytes separately from the decoded
 * source text that its checker parsed. The Node reader must prove both domains
 * before it slices declarations. Otherwise ordinary Windows-generated files
 * fail the checker-digest gate forever and details silently drops signatures
 * and docs.
 *
 * 1. Materialize equivalent functions with three BOM encodings and five
 *    ECMAScript line-terminator spellings in the same project.
 * 2. Ask the real resident `ttscgraph` server for all eight declaration details.
 * 3. Advance the same resident program through an unrelated edit, edits in all
 *    eight encodings, restoration and unchanged requests; collect every head
 *    and documentation assertion independently.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP details reads eight actual encoded source files and returns each declaration head and documentation under UTF-8 BOM, UTF-16 LE/BE and several line separators, before and after unrelated edits, encoded documentation edits and byte-exact restoration.
 * @evidence contracts/testing.md#independent-expectations Each encoded byte fixture has a literal function name, expected declaration-head string and doc sentence; expected text is not produced by the graph decoder.
 * @evidence contracts/testing.md#distinguishing-cases BOM and UTF-16 endianness contrast LF, CRLF, CR, line separator and paragraph separator inputs; unchanged, unrelated-edit, encoded-edit and restored snapshots preserve the original declaration heads and independently expected documentation.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_details_reads_bom_and_utf16_source_snapshot starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler decoding, snapshot provenance and MCP detail display must agree on these bytes and coordinates; a predecoded synthetic source cannot test that integration.
 * @evidence contracts/e2e.md#shared-execution Thirty-two identity entries share one project: twenty-eight borrow one initialized MCP/native session; four producer assertion entries and the installed decoder case borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and tour/hub contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Every original per-file exact signature and documentation assertion remains and is repeated across warm generations; encoded files and the unrelated source restore their original captured bytes finally. The case establishes supported encoding/display behavior, not a timing or filesystem-platform benchmark.
 */
export const case_ttscgraph_details_reads_bom_and_utf16_source_snapshot =
  async () => {
    const names = ["Utf8Bom", "Utf16Le", "Utf16Be", "Lf", "CrLf", "Cr", "Ls", "Ps"];
    await withIdentityBoundary(async (client, root) => {
      const failures: unknown[] = [];
      const originals = new Map(names.map((name) => [name, fs.readFileSync(path.join(root, "src", `${name}.ts`))]));
      const peer = path.join(root, "src", "identity3.ts");
      const peerBytes = fs.readFileSync(peer);
      const verify = async (stage: string, suffix = ""): Promise<void> => {
        let details: DetailsResult;
        try {
          details = detailsOf((await client.request("tools/call", {
            name: "inspect_typescript_graph", arguments: graphArguments(names),
          })) as ToolResult);
        } catch (error) { failures.push(error); return; }
        for (const name of names) {
          const node = details.nodes.find((candidate) => candidate.name === name);
          try { assert.ok(node, `${stage}: details resolves ${name}: ${JSON.stringify(details)}`); } catch (error) { failures.push(error); }
          if (node === undefined) continue;
          try { assert.equal(node.signature, `export function ${name}(): string`, `${stage}: ${name} signature`); } catch (error) { failures.push(error); }
          try { assert.equal(node.doc, `${name}${suffix} docs.`, `${stage}: ${name} doc`); } catch (error) { failures.push(error); }
        }
      };
      try {
        await verify("initial");
        await verify("unchanged");
        const peerEdit = Buffer.from(peerBytes.toString("utf8").replace("return n * 2;", "return n * 3;"));
        assert.notDeepEqual(peerEdit, peerBytes, "the unrelated private body actually changes");
        fs.writeFileSync(peer, peerEdit);
        await verify("unrelated edit");
        for (const name of names) {
          const original = originals.get(name)!;
          const encoded = name === "Utf16Be" ? Buffer.from(original.subarray(2)).swap16() : name === "Utf16Le" ? original.subarray(2) : name === "Utf8Bom" ? original.subarray(3) : original;
          const text = encoded.toString(name.startsWith("Utf16") ? "utf16le" : "utf8").replace(`${name} docs.`, `${name} edited docs.`);
          const bytes = Buffer.from(text, name.startsWith("Utf16") ? "utf16le" : "utf8");
          fs.writeFileSync(path.join(root, "src", `${name}.ts`), name === "Utf16Be" ? Buffer.concat([Buffer.from([0xfe, 0xff]), bytes.swap16()]) : name === "Utf16Le" ? Buffer.concat([Buffer.from([0xff, 0xfe]), bytes]) : name === "Utf8Bom" ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]) : bytes);
        }
        await verify("encoded edits", " edited");
      } finally {
        for (const [name, bytes] of originals) fs.writeFileSync(path.join(root, "src", `${name}.ts`), bytes);
        fs.writeFileSync(peer, peerBytes);
      }
      await verify("restored");
      await verify("restored unchanged");
      if (failures.length !== 0) throw new AggregateError(failures, "Encoded source detail failures");
    });
  };
