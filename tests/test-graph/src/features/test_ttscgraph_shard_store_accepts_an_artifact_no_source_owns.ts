import { DUMP_SCHEMA_VERSION } from "@ttsc/graph";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const graphLib = path.dirname(require.resolve("@ttsc/graph"));
const { TtscGraphShardStore } = require(
  path.join(graphLib, "model", "TtscGraphShardStore.js"),
) as {
  TtscGraphShardStore: new () => {
    apply(transaction: unknown): { nodes: { id: string; kind: string }[] };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & { TtscGraphShardStore: { shardDigest(shard: unknown): string } };

/** A metadata shard carrying one external leaf and two published artifacts. */
const metadataShard = () => ({
  key: "metadata",
  nodes: [
    {
      id: "node_modules/x/index.d.ts#X:interface",
      kind: "interface",
      name: "X",
      file: "node_modules/x/index.d.ts",
      external: true,
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
    {
      // No file at all: an operation is named by method and path, and which
      // document declared it is not part of its identity.
      id: "POST:/orders",
      kind: "swagger_operation",
      name: "POST /orders",
      file: "",
      external: false,
    },
  ],
  edges: [],
  diagnostics: [],
});

/**
 * Verifies the client accepts a metadata shard carrying published artifacts.
 *
 * The metadata shard is where facts no program source owns already live, and
 * its guard read "not external" as "authored" — correct while the only such
 * facts were external boundary leaves, and wrong the moment an artifact
 * arrived. An artifact is authored, in the sense that a person wrote the
 * document; it simply has no source to be owned by. Under the old guard the
 * client rejected the whole transaction, which is a resident session that
 * cannot start.
 *
 * The Go producer has its own copy of this rule and its own case. This is the
 * consuming half, and the two have to agree or a snapshot the producer
 * considers valid is one the client refuses.
 *
 * 1. Apply a transaction whose metadata shard carries an external leaf and two
 *    artifacts, one of them with no file at all.
 * 2. Assert the transaction is accepted and every node survives.
 */
export const test_ttscgraph_shard_store_accepts_an_artifact_no_source_owns =
  (): void => {
    const shard = metadataShard();
    const digest = (
      TtscGraphShardStore as unknown as {
        shardDigest(shard: unknown): string;
      }
    ).shardDigest(shard);
    const store = new TtscGraphShardStore();
    const dump = store.apply({
      protocolVersion: 1,
      schemaVersion: DUMP_SCHEMA_VERSION,
      project: "/fixture",
      tsconfig: "tsconfig.json",
      producer: { tool: "fixture", typescript: "7.0.0-dev" },
      capabilities: ["artifactNodes"],
      universe: { configs: [], roots: [] },
      sequence: 1,
      // The generation the store derives from this exact manifest. A literal
      // here cannot rot silently: the store recomputes it and rejects a
      // transaction whose generation does not match, so a changed fixture fails
      // loudly and names the value it expected.
      generation:
        "7ab24ddc6ab6db01295f0f583b51a8e243791519a3393fd8a328d71cdc572e36",
      upserts: [{ digest, shard }],
      deletes: [],
      manifest: [{ key: shard.key, digest }],
    });

    const kinds = new Map(dump.nodes.map((node) => [node.id, node.kind]));
    assert.equal(
      kinds.get("docs/sale.md#pricing"),
      "markdown_section",
      "the client dropped a published section from a metadata shard",
    );
    assert.equal(
      kinds.get("POST:/orders"),
      "swagger_operation",
      "the client dropped an artifact that has no file at all",
    );
    assert.equal(
      kinds.get("node_modules/x/index.d.ts#X:interface"),
      "interface",
      "the external leaf the metadata shard always carried is gone",
    );
  };
