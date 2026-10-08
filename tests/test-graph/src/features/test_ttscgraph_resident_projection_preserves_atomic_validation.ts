import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { TtscGraphMemory } from "../../../../packages/graph/src/model/TtscGraphMemory";
import { TtscGraphShardStore } from "../../../../packages/graph/src/model/TtscGraphShardStore";
import type { ITtscGraphSnapshot } from "../../../../packages/graph/src/structures/ITtscGraphSnapshot";

/**
 * Verifies projection failure and invalid transactions cannot publish partial
 * generations.
 *
 * The store must commit only after the model callback succeeds, keeping
 * validation identical for immutable and mutable consumers.
 *
 * 1. Start from one valid committed population and collect malformed delta cases.
 * 2. Throw an original cancellation or projection error after validation.
 * 3. Apply the same valid successor and require the old model and base coordinates
 *    to remain intact.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual store rejects digest, manifest, base, source/edge/config/duplicate ownership failures and callback refusals, then accepts the valid successor without partial state.
 * @evidence contracts/testing.md#independent-expectations Authored malformed fields and original thrown object identities define rejection; literal old/new signatures and successful unchanged-base successor prove atomicity.
 * @evidence contracts/testing.md#distinguishing-cases Stale coordinate, digest and generation corruption, repeated manifest, duplicate node, foreign source attribution, absent edge target, configuration mismatch and callback cancellation/refusal.
 * @evidence contracts/testing.md#execution-ownership The matching source-unit export calls actual shard validation and model projection with explicitly authored protocol inputs in-process; no worker, compiler, native host, install or build runs. Computed fixture hashes qualify inputs but do not independently prove digest encoding.
 */

export function test_ttscgraph_resident_projection_preserves_atomic_validation(): void {
  const failures: unknown[] = [];
  const cases: [string, (tx: ITtscGraphSnapshot.ITransaction) => void][] = [
    ["stale base", (tx) => (tx.baseSequence = 99)],
    ["digest", (tx) => (tx.upserts[0]!.digest = "f".repeat(64))],
    ["generation", (tx) => (tx.generation = "f".repeat(64))],
    [
      "manifest",
      (tx) => {
        tx.manifest.push(tx.manifest[0]!);
        tx.generation = generation(tx);
      },
    ],
    [
      "source ownership",
      (tx) => {
        tx.upserts[0]!.shard.nodes[0]!.file = "foreign.ts";
      },
    ],
    [
      "absent target",
      (tx) =>
        tx.upserts[0]!.shard.edges.push({
          from: tx.upserts[0]!.shard.nodes[0]!.id,
          to: "absent",
          kind: "calls",
        }),
    ],
    [
      "duplicate node",
      (tx) =>
        tx.upserts[0]!.shard.nodes.push({ ...tx.upserts[0]!.shard.nodes[0]! }),
    ],
    [
      "config universe",
      (tx) => {
        tx.universe.configs.push({ file: "tsconfig.json", digest: "authored" });
        tx.generation = generation(tx);
      },
    ],
  ];
  for (const [name, corrupt] of cases) {
    try {
      const source = shard("src/left.ts", "Left"),
        store = new TtscGraphShardStore(),
        initial = transaction([source], 1),
        first = project(store, initial);
      const changed = structuredClone(source);
      changed.nodes[0]!.signature = "(): number";
      const valid = transaction([changed], 2, initial),
        bad = structuredClone(valid);
      corrupt(bad);
      if (
        ![
          "digest",
          "generation",
          "stale base",
          "manifest",
          "config universe",
        ].includes(name)
      ) {
        bad.upserts[0]!.digest = TtscGraphShardStore.shardDigest(
          bad.upserts[0]!.shard,
        );
        bad.manifest[0]!.digest = bad.upserts[0]!.digest;
        bad.generation = generation(bad);
      }
      assert.throws(() => project(store, bad, first));
      assert.equal(first.node(source.nodes[0]!.id)!.signature, "(): void");
      assert.equal(
        project(store, valid, first).node(source.nodes[0]!.id)!.signature,
        "(): number",
      );
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  }
  for (const name of ["projection refusal", "cancellation"]) {
    try {
      const source = shard("src/left.ts", "Left"),
        store = new TtscGraphShardStore(),
        initial = transaction([source], 1),
        first = project(store, initial),
        valid = transaction([source], 2, initial, []);
      const error =
        name === "cancellation"
          ? new DOMException("authored cancellation", "AbortError")
          : new Error(name);
      assert.throws(
        () =>
          store.applyProjection(valid, () => {
            throw error;
          }),
        (actual) => actual === error,
      );
      assert.equal(
        project(store, valid, first).node(source.nodes[0]!.id),
        first.node(source.nodes[0]!.id),
      );
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Atomic resident projection matrix");
}

type Shard = ITtscGraphSnapshot.IShard;
function transaction(
  shards: Shard[],
  sequence: number,
  previous?: ITtscGraphSnapshot.ITransaction,
  changed = shards,
  deletes: string[] = [],
): ITtscGraphSnapshot.ITransaction {
  const manifest = shards
    .map((shard) => ({
      key: shard.key,
      digest: TtscGraphShardStore.shardDigest(shard),
    }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.key), Buffer.from(b.key)));
  const fields = {
    tsconfig: "tsconfig.json",
    producer: {
      tool: "authored-consumer-contract",
      version: "1",
      typescript: "no compiler",
    },
    capabilities: ["sourceDigests", "diskDigests", "docTags"],
    universe: { configs: [], roots: [] },
    manifest,
  };
  return {
    protocolVersion: 1,
    schemaVersion: 8,
    project: "/fixture",
    ...fields,
    sequence,
    generation: generation(fields),
    upserts: changed.map((shard) => ({
      shard,
      digest: TtscGraphShardStore.shardDigest(shard),
    })),
    deletes,
    ...(previous === undefined
      ? {}
      : {
          baseSequence: previous.sequence,
          baseGeneration: previous.generation,
        }),
  };
}
function generation(
  value: Pick<
    ITtscGraphSnapshot.ITransaction,
    "tsconfig" | "producer" | "capabilities" | "universe" | "manifest"
  >,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        tsconfig: value.tsconfig,
        producer: value.producer,
        capabilities: value.capabilities,
        universe: value.universe,
        manifest: value.manifest,
      }),
    )
    .digest("hex");
}
function shard(file: string, name: string): Shard {
  return {
    key: file,
    source: { file, checkerDigest: "0".repeat(64), diskDigest: "0".repeat(64) },
    nodes: [
      {
        id: file + "#" + name + ":function",
        name,
        kind: "function",
        file,
        external: false,
        signature: "(): void",
        docTags: [{ name: "evidence", text: "docs/spec.md#" + name }],
      },
    ],
    edges: [],
    diagnostics: [],
  };
}
function project(
  store: TtscGraphShardStore,
  input: ITtscGraphSnapshot.ITransaction,
  previous?: TtscGraphMemory,
): TtscGraphMemory {
  return store.applyProjection(input, (dump) =>
    TtscGraphMemory.fromResident(dump, previous),
  );
}
