import { ITtscGraphDump } from "./ITtscGraphDump";

/**
 * One response frame of the `ttscgraph serve` protocol.
 *
 * This is the envelope around a snapshot, mirrored by hand from `serveResponse`
 * in `packages/ttsc/cmd/ttscgraph/serve.go`. There is no generator between the
 * Go struct and this interface, so the two drift silently unless something
 * checks them; `TtscGraphSession` validates every frame against this shape
 * rather than casting it, so a drift surfaces as a precise error on the first
 * frame instead of an `undefined` several layers downstream.
 *
 * @evidence contracts/common.md#principled-implementation Request identity, independent protocol version and changed/error state qualify the optional full dump or shard transaction.
 * @evidence contracts/common.md#clear-and-simple-design One transport envelope keeps response routing and computation mode outside the content payload.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Mode is a producer report rather than a guessed interpretation of generation counters.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain hand-maintained wire synchronization, version independence and error/changed payload semantics.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphSnapshot declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphSnapshot declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphSnapshot declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphSnapshot declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export interface ITtscGraphSnapshot {
  /** Echoes the request's id, so a response finds its caller. */
  id: number;

  /**
   * The protocol version the server speaks.
   *
   * It rides every frame rather than a handshake. The binary and this package
   * version independently — the session runs whichever `ttscgraph` the target
   * project installed, or whatever `TTSC_GRAPH_BINARY` points at — so a
   * mismatched pair is reachable, and before this field nothing detected it:
   * the first symptom was a misparsed dump or a silently absent value.
   */
  protocolVersion: number;

  /**
   * What the producer did to answer this request.
   *
   * Required, and never absent — including on the error path, where it is
   * `"error"`. A consumer can report `rebuild` versus `incremental` honestly
   * because the compiler said so; no generation counter can distinguish a reuse
   * from a full rebuild after the fact.
   */
  mode: ITtscGraphSnapshot.Mode;

  /** What this server can prove about the snapshots it publishes. */
  capabilities: string[];

  /** Whether the graph moved since the last snapshot. */
  changed: boolean;

  /** The snapshot, present exactly when `changed` is true. */
  dump?: ITtscGraphDump;

  /** Native graph-shard transaction, present for an opted-in changed request. */
  snapshot?: ITtscGraphSnapshot.ITransaction;

  /** Set when the request produced no snapshot; `mode` is then `"error"`. */
  error?: string;
}

export namespace ITtscGraphSnapshot {
  /**
   * Versioned content-addressed transaction emitted by `ttscgraph serve`.
   *
   * Sequence and generation name this commit and its optional preceding base.
   * The complete manifest describes the resulting shard set; upserts and
   * deletes specify the change needed to reach it.
   *
   * @evidence contracts/common.md#principled-implementation Base coordinates and a complete digest manifest permit atomic validation of a delta against its preceding generation.
   * @evidence contracts/common.md#clear-and-simple-design Transaction metadata and three shard-change collections separate generation authority from fact storage.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A delta cannot silently substitute an unrelated generation; its claimed base is explicit.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains base and manifest semantics, and member comments distinguish versions, generation coordinates and payload populations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphSnapshot.ITransaction declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphSnapshot.ITransaction declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphSnapshot.ITransaction declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphSnapshot.ITransaction declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface ITransaction {
    /** Shard transaction protocol version. */
    protocolVersion: number;

    /** Schema version of the graph facts inside the shards. */
    schemaVersion: number;

    /** Producer-local absolute project locator. */
    project: string;

    /** Configuration coordinate in the dump path vocabulary. */
    tsconfig: string;

    /** Native binary and checker that produced the transaction. */
    producer: ITtscGraphDump.IProducer;

    /** Evidence capabilities reported for this generation. */
    capabilities: string[];

    /** Complete configuration and root membership inputs. */
    universe: ITtscGraphDump.IUniverse;

    /** Positive consecutive transaction number within the resident session. */
    sequence: number;

    /** Content-derived identity of the resulting generation. */
    generation: string;

    /** Preceding transaction number, absent on the initial complete frame. */
    baseSequence?: number;

    /** Preceding generation identity, absent on the initial complete frame. */
    baseGeneration?: string;

    /** New or changed shard contents, qualified by their digest. */
    upserts: IShardUpsert[];

    /** Keys removed from the preceding committed generation. */
    deletes: string[];

    /** Complete key/digest set after applying this transaction. */
    manifest: IShardReference[];
  }

  /**
   * One replacement shard and the digest used to verify its contents.
   *
   * @evidence contracts/common.md#principled-implementation Pairing content with its digest lets the receiver reject a changed or incorrectly labeled shard.
   * @evidence contracts/common.md#clear-and-simple-design The upsert contains only the payload and its content witness.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The digest qualifies actual content rather than a filename or timestamp proxy.
   * @evidence contracts/common.md#meaningful-documentation Native member comments distinguish content witness from the replacement payload.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphSnapshot.IShardUpsert declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphSnapshot.IShardUpsert declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphSnapshot.IShardUpsert declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphSnapshot.IShardUpsert declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface IShardUpsert {
    /** Hex SHA-256 of the canonical Go JSON shard representation. */
    digest: string;

    /** Complete replacement contents for the shard key inside this payload. */
    shard: IShard;
  }

  /**
   * A shard's membership and content identity in a generation manifest.
   *
   * @evidence contracts/common.md#principled-implementation Key and digest identify one retained shard version without requiring its content to be resent.
   * @evidence contracts/common.md#clear-and-simple-design The manifest reference stays distinct from an upsert because unchanged entries have no payload.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A retained entry is identified by content digest rather than assumed unchanged from its key alone.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain membership key and canonical-content digest.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphSnapshot.IShardReference declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphSnapshot.IShardReference declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphSnapshot.IShardReference declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphSnapshot.IShardReference declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface IShardReference {
    /** Logical shard ownership key. */
    key: string;

    /** Hex SHA-256 of the canonical Go JSON shard representation. */
    digest: string;
  }

  /**
   * One source/config or metadata-owned raw compiler fact shard.
   *
   * Source and config attribution are mutually exclusive. With neither, this is
   * the metadata shard for external leaves and published artifacts.
   *
   * @evidence contracts/common.md#principled-implementation Key plus optional input attribution defines ownership of the node, edge and diagnostic arrays validated by the shard store.
   * @evidence contracts/common.md#clear-and-simple-design One shard carries complete owner-local facts while the transaction controls cross-shard membership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Metadata ownership cannot be used to hide authored declarations from source attribution checks.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains mutually exclusive source/config attribution and the separate metadata role; members identify each fact population.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphSnapshot.IShard declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphSnapshot.IShard declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphSnapshot.IShard declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphSnapshot.IShard declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export interface IShard {
    /** Ownership coordinate shared with the generation manifest. */
    key: string;

    /** Source-byte witnesses when one compiler source owns this shard. */
    source?: ITtscGraphDump.ISourceDigest;

    /** Configuration-byte witness when a build configuration owns this shard. */
    config?: ITtscGraphDump.IFileDigest;

    /** Raw native nodes owned by this source or metadata shard. */
    nodes: ITtscGraphDump.INode[];

    /** Raw native edges whose source node this source shard owns. */
    edges: ITtscGraphDump.IEdge[];

    /** Compiler findings attributed to the shard's input or metadata. */
    diagnostics: ITtscGraphDump.IDiagnostic[];
  }

  /**
   * The computation modes the producer reports, plus the transport's `error`.
   *
   * - `initial`: the session's first snapshot.
   * - `reload`: the build universe moved, so the program was reloaded whole.
   * - `unchanged`: nothing moved; no dump rides it and the last one still holds.
   * - `incremental`: edits applied onto the reused resident program.
   * - `rebuild`: edits applied, but graph projection required a complete build.
   * - `error`: no snapshot was produced.
   *
   * @evidence contracts/common.md#principled-implementation Literal computation modes preserve the producer's distinction between reuse, updates, full reloads and failure.
   * @evidence contracts/common.md#clear-and-simple-design One shared union types mode reports independently of payload availability.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The client cannot rename a rebuild incremental solely to claim better performance.
   * @evidence contracts/common.md#meaningful-documentation Each mode's native bullet explains the producer event and whether a new snapshot exists.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscGraphSnapshot.Mode declares a data shape or groups members and owns no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscGraphSnapshot.Mode declares a data shape or groups members and chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscGraphSnapshot.Mode declares a data shape or groups members and coordinates no computation across requests.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscGraphSnapshot.Mode declares a data shape or groups members and performs no filesystem, path or process operation.
   */
  export type Mode =
    | "initial"
    | "reload"
    | "unchanged"
    | "incremental"
    | "rebuild"
    | "error";
}
