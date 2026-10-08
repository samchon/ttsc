import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { TtscGraphMemory } from "../../../../packages/graph/src/model/TtscGraphMemory";
import { TtscGraphShardStore } from "../../../../packages/graph/src/model/TtscGraphShardStore";
import type { ITtscGraphSnapshot } from "../../../../packages/graph/src/structures/ITtscGraphSnapshot";

/**
 * Verifies resident deltas retain unrelated immutable facts and index buckets.
 *
 * Only changed components may be rebuilt; retained snapshots and mutable public
 * dumps keep separate ownership.
 *
 * 1. Apply a multi-file population, then replace one source and one cross-file
 *    relation.
 * 2. Compare the complete projection and query indexes with full construction;
 *    inspect retained identities.
 * 3. Mutate public DTOs and caller inputs, then apply an empty delta without
 *    changing old models.
 * 4. Project a large declaration population without expanding its relations into
 *    function arguments.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual applyProjection/fromResident retain unrelated node, structural edge and ordered symbol/name/citation/relation bucket identity while changed and shortened buckets update. Public apply returns detached mutable nested records.
 * @evidence contracts/testing.md#independent-expectations Literal old/new signatures, relations and counts define changes; the independent cold full-construction path defines complete projection equivalence. Identity assertions directly distinguish unnecessary allocation without wall-clock thresholds.
 * @evidence contracts/testing.md#distinguishing-cases Many unrelated shards, incoming cross-edge change, changed shared-name bucket, empty delta, nested freeze, caller mutation, old-snapshot retention and a large structural/relation/name-index population with exact independent membership assertions.
 * @evidence contracts/testing.md#execution-ownership The matching source-unit export calls actual shard validation and model projection with explicitly authored protocol inputs in-process; no worker, compiler, native host, install or build runs. Computed fixture hashes qualify inputs but do not independently prove digest encoding.
 */

export function test_ttscgraph_resident_projection_reuses_unchanged_shards(): void {
  const inputs = Array.from({ length: 20 }, (_, i) =>
    shard(
      "src/file" + String(i).padStart(2, "0") + ".ts",
      i === 0 ? "Left" : i === 1 ? "Right" : "Stable",
    ),
  );
  const left = inputs[0]!,
    right = inputs[1]!,
    stable = inputs[2]!;
  left.edges.push({
    from: left.nodes[0]!.id,
    to: right.nodes[0]!.id,
    kind: "calls",
  });
  const store = new TtscGraphShardStore(),
    fullStore = new TtscGraphShardStore();
  const initial = transaction(inputs, 1),
    first = project(store, initial),
    publicDump = fullStore.apply(initial);
  equivalent(first, TtscGraphMemory.from(publicDump));
  const oldStable = first.node(stable.nodes[0]!.id)!;
  assert.ok(Object.isFrozen(oldStable));
  assert.ok(Object.isFrozen(oldStable.docTags));
  assert.ok(Object.isFrozen(oldStable.docTags![0]));
  publicDump.nodes.find((x) => x.id === oldStable.id)!.name = "mutated DTO";
  publicDump.nodes.find((x) => x.id === oldStable.id)!.docTags![0]!.text =
    "mutated tag";
  const changed = structuredClone(left);
  changed.nodes[0]!.signature = "(): number";
  changed.nodes[0]!.name = "Stable";
  changed.edges = [];
  inputs[0] = changed;
  const delta = transaction(inputs, 2, initial, [changed]),
    second = project(store, delta, first),
    full = TtscGraphMemory.from(fullStore.apply(delta));
  equivalent(second, full);
  for (const input of inputs.slice(1)) {
    const id = input.nodes[0]!.id;
    assert.equal(second.node(id), first.node(id));
    assert.equal(
      second.named(input.nodes[0]!.name) === first.named(input.nodes[0]!.name),
      input.nodes[0]!.name !== "Stable",
    );
    assert.equal(
      second.symbols(input.nodes[0]!.name) ===
        first.symbols(input.nodes[0]!.name),
      input.nodes[0]!.name !== "Stable",
    );
    assert.equal(second.outgoing(input.key), first.outgoing(input.key));
  }
  assert.equal(
    second.citing("docs/spec.md#Stable"),
    first.citing("docs/spec.md#Stable"),
  );
  assert.notEqual(
    second.incoming(right.nodes[0]!.id),
    first.incoming(right.nodes[0]!.id),
  );
  assert.equal(
    second.incoming(right.nodes[0]!.id).filter((x) => x.kind === "calls")
      .length,
    0,
  );
  assert.equal(
    first.incoming(right.nodes[0]!.id).filter((x) => x.kind === "calls").length,
    1,
  );
  assert.equal(first.node(left.nodes[0]!.id)!.signature, "(): void");
  assert.equal(second.node(left.nodes[0]!.id)!.signature, "(): number");
  assert.equal(second.node(oldStable.id), oldStable);
  assert.equal(oldStable.docTags![0]!.text, "docs/spec.md#Stable");
  changed.nodes[0]!.signature = "caller overwrite";
  const noop = transaction(inputs, 3, delta, []);
  noop.manifest = delta.manifest;
  noop.generation = delta.generation;
  const third = project(store, noop, second);
  assert.ok(third.nodes.every((node, index) => node === second.nodes[index]));
  assert.ok(third.edges.every((edge, index) => edge === second.edges[index]));
  assert.equal(third.node(left.nodes[0]!.id)!.signature, "(): number");
  assert.notEqual(third.source, second.source);

  // This is an input population, not a performance threshold. Structural
  // edges and shared query buckets must not become a function argument list.
  const count = 140_000;
  const large = shard("src/large.ts", "Large");
  large.nodes = Array.from({ length: count }, (_, index) => ({
    id: large.key + "#N" + String(index).padStart(6, "0") + ":function",
    name: "Large",
    kind: "function",
    file: large.key,
    external: false,
  }));
  const largeModel = project(
    new TtscGraphShardStore(),
    transaction([large], 1),
  );
  assert.equal(largeModel.nodes.length, count + 1);
  assert.equal(largeModel.edges.length, count);
  assert.equal(largeModel.named("Large").length, count);
  assert.equal(largeModel.symbols("Large").length, count);
  assert.equal(largeModel.outgoing(large.key).length, count);
  for (const [index, node] of large.nodes.entries()) {
    assert.equal(largeModel.node(node.id)!.name, "Large");
    assert.deepEqual(largeModel.edges[index], {
      from: large.key,
      to: node.id,
      kind: "contains",
    });
    assert.equal(largeModel.named("Large")[index], largeModel.node(node.id));
    assert.equal(largeModel.symbols("Large")[index], largeModel.node(node.id));
    assert.equal(largeModel.incoming(node.id)[0], largeModel.edges[index]);
  }
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
function equivalent(actual: TtscGraphMemory, full: TtscGraphMemory): void {
  assert.deepEqual(actual.nodes, full.nodes);
  assert.deepEqual(actual.edges, full.edges);
  for (const node of full.nodes) {
    assert.deepEqual(actual.node(node.id), node);
    assert.deepEqual(actual.named(node.name), full.named(node.name));
    assert.deepEqual(
      actual.symbols(node.qualifiedName ?? node.name),
      full.symbols(node.qualifiedName ?? node.name),
    );
    assert.deepEqual(actual.incoming(node.id), full.incoming(node.id));
    assert.deepEqual(actual.outgoing(node.id), full.outgoing(node.id));
  }
  for (const target of [
    "docs/spec.md#Left",
    "docs/spec.md#Right",
    "docs/spec.md#Stable",
  ])
    assert.deepEqual(actual.citing(target), full.citing(target));
}
