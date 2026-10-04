import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Client = {
  request(method: string, params: unknown): Promise<unknown>;
  assertInputMutationAllowed(): void;
  preventInputReuse(reason: string): void;
};
const names = ["Utf8Bom", "Utf16Le", "Utf16Be", "Lf", "CrLf", "Cr", "Ls", "Ps"];
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

/** Materializes raw byte inputs in the shared graph preparation before any native snapshot. */
export function writeGraphEncodedInputs(root: string): void {
  const source = (name: string, terminator = "\n") => [
    `/** ${name} docs. */`, `export function ${name}(): string {`,
    `  return "${name}";`, "}", "",
  ].join(terminator);
  fs.writeFileSync(path.join(root, "src", "Utf8Bom.ts"), Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(source("Utf8Bom")),
  ]));
  fs.writeFileSync(path.join(root, "src", "Utf16Le.ts"), Buffer.concat([
    Buffer.from([0xff, 0xfe]), Buffer.from(source("Utf16Le"), "utf16le"),
  ]));
  fs.writeFileSync(path.join(root, "src", "Utf16Be.ts"), Buffer.concat([
    Buffer.from([0xfe, 0xff]), Buffer.from(source("Utf16Be"), "utf16le").swap16(),
  ]));
  for (const [name, terminator] of [
    ["Lf", "\n"], ["CrLf", "\r\n"], ["Cr", "\r"], ["Ls", "\u2028"], ["Ps", "\u2029"],
  ]) fs.writeFileSync(path.join(root, "src", `${name}.ts`), source(name!, terminator));
  fs.writeFileSync(path.join(root, "src", "encoding-peer.ts"),
    "export function encodingPeer(n: number): number { return n * 2; }\n");
}

/**
 * Observes all raw encodings through the existing resident graph boundary.
 * @evidence contracts/testing.md#behavioral-verification Each real UTF8 BOM/UTF16 endian/line-separator declaration retains exact signature and documentation in initial, unchanged, unrelated edit, encoded edit and restored native MCP replies.
 * @evidence contracts/testing.md#independent-expectations Eight authored raw-byte functions prescribe literal heads/docs independently of graph decoding; the unrelated peer body actually changes and does not define expected facts.
 * @evidence contracts/testing.md#distinguishing-cases Every encoding is asserted separately through original byte restoration; unrelated versus documentation edit distinguishes stale display from refresh.
 * @evidence contracts/testing.md#execution-ownership Called once with the selected graph entry's existing initialized client and shared upfront byte population; per-file loops write/read assertions, never prepare/load/launch another host or profile.
 * @evidence contracts/e2e.md#necessary-boundary Actual native decoder/checker digest and MCP display must agree on raw bytes; no predecoded fake snapshot is supplied.
 * @evidence contracts/e2e.md#shared-execution All eight initial files coexist before the first native snapshot; two edit categories and restoration advance the same resident generation with explicit refresh cost, without client recreation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original encoded and peer bytes restore individually under client mutation authority; failed restoration withdraws input reuse and the selected entry joins host exit.
 * @evidence contracts/e2e.md#preserved-coverage Every original per-file exact signature/doc assertion and reset/recovery phase is retained. No global Program1 or executed-success claim is made.
 */
export async function assertGraphEncodedCorpus(client: Client, root: string): Promise<void> {
      const failures: unknown[] = [];
      const originals = new Map(
        names.map((name) => [
          name,
          fs.readFileSync(path.join(root, "src", `${name}.ts`)),
        ]),
      );
      const peer = path.join(root, "src", "encoding-peer.ts");
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

}
