import assert from "node:assert/strict";

import { TtscGraphShardStore } from "../../../../packages/graph/src/model/TtscGraphShardStore";
import { DUMP_SCHEMA_VERSION } from "../../../../packages/graph/src/model/loadGraph";
import type { ITtscGraphSnapshot } from "../../../../packages/graph/src/structures/ITtscGraphSnapshot";

/** A metadata shard carrying one external leaf and two published artifacts. */
const metadataShard = (): ITtscGraphSnapshot.IShard => ({
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
 *
 * @evidence contracts/testing.md#behavioral-verification Authored TtscGraphShardStore.apply accepts a metadata transaction containing a Markdown section, a fileless Swagger operation and an external interface; all three literal node kinds survive reconstruction instead of artifacts being rejected as source-owned facts.
 * @evidence contracts/testing.md#independent-expectations Literal IDs and expected kinds come from the declared artifact and external-leaf inputs, and the pinned generation covers the authored fixture producer identity. The shard digest is produced by shardDigest, so this case does not independently prove digest correctness; it tests acceptance and node preservation.
 * @evidence contracts/testing.md#distinguishing-cases The metadata shard combines a file-bearing section and an operation with an empty file alongside the external leaf previously accepted by this guard, distinguishing artifact acceptance from rejecting all non-external nodes or losing existing external facts. Invalid authored-node ownership is outside this positive consumer case.
 * @evidence contracts/testing.md#execution-ownership The matching src/features test_ttscgraph_shard_store_accepts_an_artifact_no_source_owns export directly imports the authored shard store and schema version; the source-unit runner executes the synchronous transaction in its Node process without requiring a built CJS graph package or spawning a native producer.
 */
export function test_ttscgraph_shard_store_accepts_an_artifact_no_source_owns(): void {
  const shard = metadataShard();
  const digest = TtscGraphShardStore.shardDigest(shard);
  const store = new TtscGraphShardStore();
  const dump = store.apply({
    protocolVersion: 1,
    schemaVersion: DUMP_SCHEMA_VERSION,
    project: "/fixture",
    tsconfig: "tsconfig.json",
    producer: {
      tool: "fixture",
      version: "fixture-v1",
      typescript: "7.0.0-dev",
    },
    capabilities: ["artifactNodes"],
    universe: { configs: [], roots: [] },
    sequence: 1,
    // The generation the store derives from this exact manifest. A literal
    // here cannot rot silently: the store recomputes it and rejects a
    // transaction whose generation does not match, so a changed fixture fails
    // loudly and names the value it expected.
    generation:
      "5f742ac15325301beaf9a0c0e46d34637a50631a9ac909b157ef4b4b225c3692",
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
}
