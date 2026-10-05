import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { ITtscGraphSnapshot } from "../structures/ITtscGraphSnapshot";
import { isArtifactNodeKind } from "../structures/TtscGraphArtifactNodeKind";
import { TtscGraphReadonly } from "./TtscGraphReadonly";
import { copyGraphRecords } from "./copyGraphRecords";
import { copyGraphSnapshot } from "./copyGraphSnapshot";
import { DUMP_SCHEMA_VERSION } from "./loadGraph";

/**
 * Atomic validator and assembler for native ttscgraph shard transactions.
 *
 * A transaction is committed only after base coordinates, digests, ownership
 * and the complete manifest agree. Rejected transactions preserve prior state.
 *
 * @evidence contracts/common.md#principled-implementation Content digests and consecutive base coordinates qualify source-owned shards before cross-shard assembly and atomic state replacement.
 * @evidence contracts/common.md#clear-and-simple-design The store owns committed generation state; private validation and assembly helpers keep wire checks outside consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Stale bases or inconsistent contents are rejected rather than merged under compensating guesses.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the commit boundary and preserved prior state; public methods describe validation and canonical hashing.
 * @evidenceExclude contracts/performance.md#efficient-algorithms apply owns staged validation and assembly algorithms; this declaration defines committed state.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work apply establishes permission to reuse unchanged shard payloads.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources apply owns population replacement and the session owns store retirement; the class declaration performs no independent lifecycle transition.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation validates and assembles in-memory shard objects; no file, path or process.
 */
export class TtscGraphShardStore {
  static readonly PROTOCOL_VERSION = 1;

  private sequence: number | undefined;
  private generation: string | undefined;
  private project: string | undefined;
  private tsconfig: string | undefined;
  private shards = new Map<
    string,
    { digest: string; shard: TtscGraphReadonly<ITtscGraphSnapshot.IShard> }
  >();

  /**
   * Validate and atomically commit one complete or base-generation delta.
   *
   * Throws on invalid coordinates, repeated changes, content/manifest mismatch
   * or inconsistent ownership. The prior generation remains committed until
   * full dump assembly succeeds. Retained shard records are detached and
   * frozen; the returned dump owns mutable copies of those records.
   *
   * @evidence contracts/common.md#principled-implementation A staged shard map validates changes, exact manifest and generation hash before assembly establishes node/edge/config ownership and commits state together.
   * @evidence contracts/common.md#clear-and-simple-design One operation owns transaction staging and the final state swap; helper validators do not independently mutate committed fields.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A bad delta is not retried against an invented base or partially applied to the resident store.
   * @evidence contracts/common.md#meaningful-documentation Native prose documents rejection causes and the unchanged-state guarantee before the tags.
   * @evidence contracts/performance.md#efficient-algorithms Map staging and manifest/ownership scans are linear in shards and facts; canonical hashes cost changed content bytes and deterministic dump sorting costs O(N log N + E log E).
   * @evidence contracts/performance.md#reuse-equivalent-work Unchanged frozen shard payloads retain their validated digest in the staged map; only upserts are rehashed, while the generation manifest validates continued membership and mutable output copies cannot change retained facts.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The store retains only the current manifest's shards and coordinates; commit drops removed payloads and rejection leaves the prior generation intact.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation validates and assembles shard objects in memory and hashes JSON text with node:crypto; no file, path or process.
   */
  apply(transaction: ITtscGraphSnapshot.ITransaction): ITtscGraphDump {
    this.assertCoordinates(transaction);
    const next = new Map(this.shards);
    const touched = new Set<string>();
    for (const key of transaction.deletes) {
      assertShardKey(key);
      if (touched.has(key)) {
        throw new Error(`@ttsc/graph: native transaction repeats shard ${key}`);
      }
      touched.add(key);
      if (!next.delete(key)) {
        throw new Error(
          `@ttsc/graph: native transaction deletes unknown shard ${key}`,
        );
      }
    }
    for (const upsert of transaction.upserts) {
      assertShardKey(upsert.shard.key);
      if (touched.has(upsert.shard.key)) {
        throw new Error(
          `@ttsc/graph: native transaction touches shard ${upsert.shard.key} more than once`,
        );
      }
      touched.add(upsert.shard.key);
      const digest = TtscGraphShardStore.shardDigest(upsert.shard);
      if (digest !== upsert.digest) {
        throw new Error(
          `@ttsc/graph: native shard ${upsert.shard.key} digest ${upsert.digest} does not match ${digest}`,
        );
      }
      next.set(upsert.shard.key, {
        digest,
        shard: copyGraphSnapshot(upsert.shard),
      });
    }

    const manifest = [...transaction.manifest];
    for (let index = 0; index < manifest.length; index++) {
      const reference = manifest[index]!;
      if (
        index !== 0 &&
        compareText(manifest[index - 1]!.key, reference.key) >= 0
      ) {
        throw new Error(
          "@ttsc/graph: native shard manifest must be strictly key-sorted",
        );
      }
    }
    if (manifest.length !== next.size) {
      throw new Error(
        "@ttsc/graph: native shard manifest does not describe the reconstructed generation",
      );
    }
    for (const reference of manifest) {
      assertShardKey(reference.key);
      const committed = next.get(reference.key);
      if (committed === undefined || committed.digest !== reference.digest) {
        throw new Error(
          `@ttsc/graph: native shard manifest disagrees at ${reference.key}`,
        );
      }
    }
    const generation = digest({
      tsconfig: transaction.tsconfig,
      producer: transaction.producer,
      capabilities: transaction.capabilities,
      universe: transaction.universe,
      manifest,
    });
    if (generation !== transaction.generation) {
      throw new Error(
        `@ttsc/graph: native generation ${transaction.generation} does not match ${generation}`,
      );
    }

    const dump = assemble(transaction, next);
    this.sequence = transaction.sequence;
    this.generation = transaction.generation;
    this.project = transaction.project;
    this.tsconfig = transaction.tsconfig;
    this.shards = next;
    return dump;
  }

  /**
   * SHA-256 over the producer's deterministic Go JSON encoding.
   *
   * JSON-serializable wire shards use producer field order and Go's escaping
   * for HTML-sensitive characters and Unicode line separators.
   *
   * @evidence contracts/common.md#principled-implementation Canonical Go-compatible JSON escaping and UTF-8 SHA-256 reproduce the producer's content witness for the supplied wire shard.
   * @evidence contracts/common.md#clear-and-simple-design One helper shares canonical digest logic with generation verification.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Digest checks compare content rather than a size/time proxy or expected fixture hash.
   * @evidence contracts/common.md#meaningful-documentation Native prose states serializability, ordering and escaping premises needed for cross-language digest equivalence.
   * @evidence contracts/performance.md#efficient-algorithms Serialization preserves the wire object's insertion order, escapes Go-sensitive characters in one text pass and hashes the resulting bytes once.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This digest primitive computes one shard identity; apply coordinates continued reuse of validated payloads.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The digest string transfers to its caller and the canonical buffer is local to this computation.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation hashes the canonical JSON text of one shard with node:crypto; no file, path or process.
   */
  static shardDigest(shard: ITtscGraphSnapshot.IShard): string {
    return digest(shard);
  }

  private assertCoordinates(
    transaction: ITtscGraphSnapshot.ITransaction,
  ): void {
    if (transaction.protocolVersion !== TtscGraphShardStore.PROTOCOL_VERSION) {
      throw new Error(
        `@ttsc/graph: ttscgraph sends graph snapshot protocol v${String(transaction.protocolVersion)}, this client reads v${String(TtscGraphShardStore.PROTOCOL_VERSION)}`,
      );
    }
    if (transaction.schemaVersion !== DUMP_SCHEMA_VERSION) {
      throw new Error(
        `@ttsc/graph: ttscgraph sends dump schema v${String(transaction.schemaVersion)}, this client reads v${String(DUMP_SCHEMA_VERSION)}`,
      );
    }
    if (
      !Number.isSafeInteger(transaction.sequence) ||
      transaction.sequence < 1
    ) {
      throw new Error("@ttsc/graph: native transaction sequence is invalid");
    }
    if (transaction.generation === "") {
      throw new Error("@ttsc/graph: native transaction generation is empty");
    }
    if (this.sequence === undefined || this.generation === undefined) {
      if (
        transaction.sequence !== 1 ||
        transaction.baseSequence !== undefined ||
        transaction.baseGeneration !== undefined ||
        transaction.deletes.length !== 0
      ) {
        throw new Error(
          "@ttsc/graph: initial native transaction is not a complete generation",
        );
      }
      return;
    }
    if (
      transaction.sequence !== this.sequence + 1 ||
      transaction.baseSequence !== this.sequence ||
      transaction.baseGeneration !== this.generation
    ) {
      throw new Error(
        `@ttsc/graph: native transaction has stale base ${String(transaction.baseSequence)}/${String(transaction.baseGeneration)}`,
      );
    }
    if (
      transaction.project !== this.project ||
      transaction.tsconfig !== this.tsconfig
    ) {
      throw new Error(
        "@ttsc/graph: native transaction changed its resident project coordinates",
      );
    }
  }
}

function assemble(
  transaction: ITtscGraphSnapshot.ITransaction,
  committed: ReadonlyMap<
    string,
    { digest: string; shard: TtscGraphReadonly<ITtscGraphSnapshot.IShard> }
  >,
): ITtscGraphDump {
  const nodes: ITtscGraphDump.INode[] = [];
  const edges: ITtscGraphDump.IEdge[] = [];
  const diagnostics: ITtscGraphDump.IDiagnostic[] = [];
  const sources: ITtscGraphDump.ISourceDigest[] = [];
  const nodeOwners = new Map<string, string>();
  const sourceFiles = new Set<string>();
  const configInputs = new Map<string, string>();
  for (const [key, value] of committed) {
    const shard = copyGraphRecords<ITtscGraphSnapshot.IShard>(value.shard);
    if (shard.key !== key) {
      throw new Error(`@ttsc/graph: native shard key disagrees at ${key}`);
    }
    if (shard.source !== undefined && shard.config !== undefined) {
      throw new Error(
        `@ttsc/graph: native shard ${key} claims both source and config input`,
      );
    }
    if (
      shard.config !== undefined &&
      (shard.nodes.length !== 0 || shard.edges.length !== 0)
    ) {
      throw new Error(
        `@ttsc/graph: native config shard ${key} unexpectedly owns facts`,
      );
    }
    if (shard.config !== undefined) {
      if (configInputs.has(shard.config.file)) {
        throw new Error(
          `@ttsc/graph: native config ${shard.config.file} has more than one shard`,
        );
      }
      configInputs.set(shard.config.file, shard.config.digest);
    }
    if (shard.source !== undefined) {
      if (sourceFiles.has(shard.source.file)) {
        throw new Error(
          `@ttsc/graph: native source ${shard.source.file} has more than one shard`,
        );
      }
      sourceFiles.add(shard.source.file);
      sources.push({ ...shard.source });
    }
    assertShardContents(key, shard);
    for (const node of shard.nodes) {
      const owner = nodeOwners.get(node.id);
      if (owner !== undefined) {
        throw new Error(
          `@ttsc/graph: native node ${node.id} is owned by both ${owner} and ${key}`,
        );
      }
      nodeOwners.set(node.id, key);
      nodes.push(node);
    }
    for (const entryToAppend of shard.edges) edges.push(entryToAppend);
    for (const entryToAppend of shard.diagnostics)
      diagnostics.push(entryToAppend);
  }
  for (const [key, value] of committed) {
    for (const edge of value.shard.edges) {
      if (nodeOwners.get(edge.from) !== key) {
        throw new Error(
          `@ttsc/graph: native shard ${key} does not own edge source ${edge.from}`,
        );
      }
      if (!nodeOwners.has(edge.to)) {
        throw new Error(
          `@ttsc/graph: native edge target is absent from the generation: ${edge.to}`,
        );
      }
    }
  }
  const unmatchedConfigs = new Map(configInputs);
  for (const config of transaction.universe.configs) {
    if (
      unmatchedConfigs.get(config.file) !== config.digest ||
      !unmatchedConfigs.delete(config.file)
    ) {
      throw new Error(
        `@ttsc/graph: native config shard disagrees with universe input ${config.file}`,
      );
    }
  }
  if (unmatchedConfigs.size !== 0) {
    throw new Error(
      "@ttsc/graph: native config shards do not cover the build universe",
    );
  }
  nodes.sort((left, right) => compareText(left.id, right.id));
  edges.sort(
    (left, right) =>
      compareText(left.from, right.from) ||
      compareText(left.to, right.to) ||
      compareText(left.kind, right.kind),
  );
  diagnostics.sort(
    (left, right) =>
      compareText(left.file, right.file) ||
      left.line - right.line ||
      left.column - right.column ||
      left.code - right.code,
  );
  sources.sort((left, right) => compareText(left.file, right.file));
  return {
    project: transaction.project,
    tsconfig: transaction.tsconfig,
    provenance: {
      schemaVersion: transaction.schemaVersion,
      capabilities: [...transaction.capabilities],
      producer: { ...transaction.producer },
      universe: {
        configs: transaction.universe.configs.map((config) => ({ ...config })),
        roots: transaction.universe.roots.map((root) => ({ ...root })),
      },
      sources,
    },
    diagnostics,
    nodes,
    edges,
  };
}

function assertShardContents(
  key: string,
  shard: ITtscGraphSnapshot.IShard,
): void {
  if (shard.source !== undefined) {
    for (const node of shard.nodes) {
      if (node.external || node.file !== shard.source.file) {
        throw new Error(
          `@ttsc/graph: native source shard ${key} owns node ${node.id} from ${node.file}`,
        );
      }
    }
    for (const diagnostic of shard.diagnostics) {
      if (diagnostic.file !== shard.source.file) {
        throw new Error(
          `@ttsc/graph: native source shard ${key} owns diagnostic from ${diagnostic.file}`,
        );
      }
    }
    return;
  }
  if (shard.edges.length !== 0) {
    throw new Error(
      `@ttsc/graph: native non-source shard ${key} unexpectedly owns edges`,
    );
  }
  if (shard.config !== undefined) {
    for (const diagnostic of shard.diagnostics) {
      if (diagnostic.file !== shard.config.file) {
        throw new Error(
          `@ttsc/graph: native config shard ${key} owns diagnostic from ${diagnostic.file}`,
        );
      }
    }
    return;
  }
  // The metadata shard carries the nodes no program source owns: external
  // boundary leaves, and published artifacts. An artifact has no source to be
  // owned by, so the guard that keeps authored declarations out of this shard
  // names it rather than treating "not external" as "authored".
  for (const node of shard.nodes) {
    if (!node.external && !isArtifactNodeKind(node.kind)) {
      throw new Error(
        `@ttsc/graph: native metadata shard ${key} owns authored node ${node.id}`,
      );
    }
  }
  for (const diagnostic of shard.diagnostics) {
    if (diagnostic.file !== "") {
      throw new Error(
        `@ttsc/graph: native metadata shard ${key} owns diagnostic from ${diagnostic.file}`,
      );
    }
  }
}

function assertShardKey(key: string): void {
  if (key === "" || key.includes("\0")) {
    throw new Error(`@ttsc/graph: native shard key is invalid: ${key}`);
  }
}

function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function goJSON(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/gu, (character) => {
    switch (character) {
      case "<":
        return "\\u003c";
      case ">":
        return "\\u003e";
      case "&":
        return "\\u0026";
      case "\u2028":
        return "\\u2028";
      default:
        return "\\u2029";
    }
  });
}

function digest(value: unknown): string {
  return createHash("sha256").update(goJSON(value)).digest("hex");
}
