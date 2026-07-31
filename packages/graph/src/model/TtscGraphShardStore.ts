import { createHash } from "node:crypto";

import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { ITtscGraphSnapshot } from "../structures/ITtscGraphSnapshot";
import { DUMP_SCHEMA_VERSION } from "./loadGraph";

/** Atomic validator and assembler for native `ttscgraph` shard transactions. */
export class TtscGraphShardStore {
  static readonly PROTOCOL_VERSION = 1;

  private sequence: number | undefined;
  private generation: string | undefined;
  private project: string | undefined;
  private tsconfig: string | undefined;
  private shards = new Map<
    string,
    { digest: string; shard: ITtscGraphSnapshot.IShard }
  >();

  /** Validate and atomically commit one complete or base-generation delta. */
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
      next.set(upsert.shard.key, { digest, shard: upsert.shard });
    }

    const manifest = [...transaction.manifest];
    const ordered = [...manifest].sort((left, right) =>
      compareText(left.key, right.key),
    );
    if (!sameManifest(manifest, ordered)) {
      throw new Error(
        "@ttsc/graph: native shard manifest must be strictly key-sorted",
      );
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

  /** SHA-256 over the producer's deterministic Go JSON encoding. */
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
    { digest: string; shard: ITtscGraphSnapshot.IShard }
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
    const shard = value.shard;
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
    edges.push(...shard.edges);
    diagnostics.push(...shard.diagnostics);
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
  if (configInputs.size !== transaction.universe.configs.length) {
    throw new Error(
      "@ttsc/graph: native config shards do not cover the build universe",
    );
  }
  for (const config of transaction.universe.configs) {
    if (configInputs.get(config.file) !== config.digest) {
      throw new Error(
        `@ttsc/graph: native config shard disagrees with universe input ${config.file}`,
      );
    }
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
  for (const node of shard.nodes) {
    if (!node.external) {
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

function sameManifest(
  left: readonly ITtscGraphSnapshot.IShardReference[],
  right: readonly ITtscGraphSnapshot.IShardReference[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (value, index) =>
        value.key === right[index]?.key &&
        value.digest === right[index]?.digest,
    )
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
