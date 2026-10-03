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
 * 1. Materialize equivalent functions with three BOM encodings and five ECMAScript
 *    line-terminator spellings in the same project.
 * 2. Ask the real resident `ttscgraph` server for all eight declaration details.
 * 3. Advance the same resident session through an unrelated edit, edits in all
 *    eight encodings, restoration and unchanged requests; collect every head
 *    and documentation assertion independently.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP details reads eight actual encoded source files and returns each declaration head and documentation under UTF-8 BOM, UTF-16 LE/BE and several line separators, before and after unrelated edits, encoded documentation edits and byte-exact restoration.
 * @evidence contracts/testing.md#independent-expectations Each encoded byte fixture has a literal function name, expected declaration-head string and doc sentence; expected text is not produced by the graph decoder.
 * @evidence contracts/testing.md#distinguishing-cases BOM and UTF-16 endianness contrast LF, CRLF, CR, line separator and paragraph separator inputs; unchanged, unrelated-edit, encoded-edit and restored snapshots preserve the original declaration heads and independently expected documentation.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_details_reads_bom_and_utf16_source_snapshot borrows the experiment's shared built workspace MCP/native session and drives its actual stdio connection with the explicit workspace binary override; this is not a consumer-local packed SDK installation. It remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler decoding, snapshot provenance and MCP detail display must agree on these bytes and coordinates; a predecoded synthetic source cannot test that integration.
 * @evidence contracts/e2e.md#shared-execution Identity consumers share one project and resident MCP/native session. Immutable producer assertions and built workspace decoders borrow one cached CLI dump; checker dispatch uses both. Raw dump preparation alone starts no MCP. Cold escape and a controlled unlinked transition reuse the identity project, with one additional dump for changed membership. Ranking, tag and tour/hub inputs retain closed source universes; edits and config restoration advance actual generations without fresh clients. Sharing the client/project is not proof of Program-object reuse, total construction or packed publication identity.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes after settled requests; a timed-out or lost transport forbids further edits and resets, withdraws reuse and retains both project and external receipt inputs until the experiment attempts actual child joins. Tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology. Cached CLI facts serve unchanged assertions.
 * @evidence contracts/e2e.md#preserved-coverage Every original per-file exact signature and documentation assertion remains and is repeated across warm generations; encoded files and the unrelated source restore their original captured bytes finally. The case establishes supported encoding/display behavior, not a timing or filesystem-platform benchmark.
 */
export const case_ttscgraph_details_reads_bom_and_utf16_source_snapshot =
  async () => {
    const names = [
      "Utf8Bom",
      "Utf16Le",
      "Utf16Be",
      "Lf",
      "CrLf",
      "Cr",
      "Ls",
      "Ps",
    ];
    await withIdentityBoundary(async (client, root) => {
      const failures: unknown[] = [];
      const originals = new Map(
        names.map((name) => [
          name,
          fs.readFileSync(path.join(root, "src", `${name}.ts`)),
        ]),
      );
      const peer = path.join(root, "src", "identity3.ts");
      const peerBytes = fs.readFileSync(peer);
      const restorationErrors: unknown[] = [];
      const verify = async (stage: string, suffix = ""): Promise<void> => {
        let details: DetailsResult;
        try {
          details = detailsOf(
            (await client.request("tools/call", {
              name: "inspect_typescript_graph",
              arguments: graphArguments(names),
            })) as ToolResult,
          );
        } catch (error) {
          failures.push(error);
          return;
        }
        for (const name of names) {
          const node = details.nodes.find(
            (candidate) => candidate.name === name,
          );
          try {
            assert.ok(
              node,
              `${stage}: details resolves ${name}: ${JSON.stringify(details)}`,
            );
          } catch (error) {
            failures.push(error);
          }
          if (node === undefined) continue;
          try {
            assert.equal(
              node.signature,
              `export function ${name}(): string`,
              `${stage}: ${name} signature`,
            );
          } catch (error) {
            failures.push(error);
          }
          try {
            assert.equal(
              node.doc,
              `${name}${suffix} docs.`,
              `${stage}: ${name} doc`,
            );
          } catch (error) {
            failures.push(error);
          }
        }
      };
      try {
        await verify("initial");
        await verify("unchanged");
        const peerEdit = Buffer.from(
          peerBytes.toString("utf8").replace("return n * 2;", "return n * 3;"),
        );
        client.assertInputMutationAllowed();
        assert.notDeepEqual(
          peerEdit,
          peerBytes,
          "the unrelated private body actually changes",
        );
        fs.writeFileSync(peer, peerEdit);
        await verify("unrelated edit");
        for (const name of names) {
          client.assertInputMutationAllowed();
          const original = originals.get(name)!;
          const encoded =
            name === "Utf16Be"
              ? Buffer.from(original.subarray(2)).swap16()
              : name === "Utf16Le"
                ? original.subarray(2)
                : name === "Utf8Bom"
                  ? original.subarray(3)
                  : original;
          const text = encoded
            .toString(name.startsWith("Utf16") ? "utf16le" : "utf8")
            .replace(`${name} docs.`, `${name} edited docs.`);
          const bytes = Buffer.from(
            text,
            name.startsWith("Utf16") ? "utf16le" : "utf8",
          );
          fs.writeFileSync(
            path.join(root, "src", `${name}.ts`),
            name === "Utf16Be"
              ? Buffer.concat([Buffer.from([0xfe, 0xff]), bytes.swap16()])
              : name === "Utf16Le"
                ? Buffer.concat([Buffer.from([0xff, 0xfe]), bytes])
                : name === "Utf8Bom"
                  ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes])
                  : bytes,
          );
        }
        await verify("encoded edits", " edited");
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          client.assertInputMutationAllowed();
        } catch (error) {
          throw new AggregateError(
            [...failures, error],
            "Encoded reset refused while child completion is unconfirmed",
          );
        }
        for (const restore of [
          ...Array.from(
            originals,
            ([name, bytes]) =>
              () =>
                fs.writeFileSync(path.join(root, "src", `${name}.ts`), bytes),
          ),
          () => fs.writeFileSync(peer, peerBytes),
        ]) {
          try {
            restore();
          } catch (error) {
            restorationErrors.push(error);
          }
        }
        if (restorationErrors.length)
          client.preventInputReuse("Encoded source or peer restoration failed");
      }
      if (restorationErrors.length)
        throw new AggregateError(
          [...failures, ...restorationErrors],
          "Encoded detail assertions and source reset failed",
        );
      await verify("restored");
      await verify("restored unchanged");
      if (failures.length !== 0)
        throw new AggregateError(failures, "Encoded source detail failures");
    });
  };
