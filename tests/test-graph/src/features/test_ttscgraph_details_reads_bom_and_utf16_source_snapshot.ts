import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

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
 * 3. Assert each result carries its compiler-aligned signature head and doc.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP details reads eight actual encoded source files and returns each declaration head and documentation under UTF-8 BOM, UTF-16 LE/BE and several line separators.
 * @evidence contracts/testing.md#independent-expectations Each encoded byte fixture has a literal function name, expected declaration-head string and doc sentence; expected text is not produced by the graph decoder.
 * @evidence contracts/testing.md#distinguishing-cases BOM and UTF-16 endianness contrast LF, CRLF, CR, line separator and paragraph separator inputs; body text must not leak into the expected head.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_details_reads_bom_and_utf16_source_snapshot starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler decoding, snapshot provenance and MCP detail display must agree on these bytes and coordinates; a predecoded synthetic source cannot test that integration.
 * @evidence contracts/e2e.md#shared-execution Eighteen identity/display, documentation/citation, DTO/audit and dispatch entries borrow one composite project, initialized MCP session and resident native compiler. Only the object-source mutation requires a new generation. The checker-rejection entry also executes the public dump CLI once because diagnostics/raw edges are a separate entrypoint connection; all named assertions remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique source files, symbol names and citation targets isolate fixtures; disjoint dispatch contracts and hub populations prevent cross-case implementations. Role-sensitive sources retain their spec/test suffix and real dependency declarations stay external. Only object-outline.ts changes; suite finally closes the shared client and checks successful exit after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Every original per-file exact signature and documentation assertion remains. The case establishes supported encoding/display behavior, not a timing or filesystem-platform benchmark.
 */
export const test_ttscgraph_details_reads_bom_and_utf16_source_snapshot =
  async () => {
    const names = ["Utf8Bom", "Utf16Le", "Utf16Be", "Lf", "CrLf", "Cr", "Ls", "Ps"];
    await withIdentityBoundary(async (client) => {
      const details = detailsOf(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments(names),
        })) as ToolResult,
      );
      const failures: unknown[] = [];
      for (const name of names) {
        try {
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
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length !== 0)
        throw new AggregateError(failures, "Encoded source detail failures");
    });
  };
