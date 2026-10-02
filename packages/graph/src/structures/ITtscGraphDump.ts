import { ITtscGraphEdge } from "./ITtscGraphEdge";
import { ITtscGraphNode } from "./ITtscGraphNode";
import { ITtscGraphSpan } from "./ITtscGraphSpan";
import { TtscGraphDumpEdgeKind } from "./TtscGraphDumpEdgeKind";
import { TtscGraphDumpNodeKind } from "./TtscGraphDumpNodeKind";

/**
 * The whole-graph export `ttscgraph dump` writes and the MCP server loads — the
 * wire contract between the Go fact-builder and the TypeScript graph engine.
 *
 * It is the complete graph with none of the per-response caps the MCP tools
 * apply: every node and edge the build resolved, plus the `provenance` that
 * says which program resolved them. The server parses each changed native
 * snapshot (typia-validated) into an in-memory resident graph and reuses that
 * warm model while project inputs stay unchanged; the bundled 3D viewer reduces
 * the same dump.
 *
 * `project` is the producer-local absolute locator. Every identity-bearing path
 * uses one portable coordinate relative to it: project files are ordinary
 * relative paths; same-filesystem siblings use `../` segments; package files
 * keep their full resolution context (including version/peer-store segments);
 * and a virtual compiler source stays `bundled:///…`. Raw absolute identities
 * are never emitted. A source on another drive or UNC share makes the producer
 * fail unless a future contract supplies a logical root for it.
 *
 * @evidence contracts/common.md#principled-implementation Provenance, diagnostics and complete node/edge arrays represent one producer generation with explicit portable identity coordinates.
 * @evidence contracts/common.md#clear-and-simple-design The wire envelope separates origin and build universe from graph facts; span paths are reconstructed by the loader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native output is the full graph rather than a fixture-specific capped subset.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain producer/consumer roles, generation ownership and the portable path vocabulary.
 */
export interface ITtscGraphDump {
  /** Absolute path of the project root the graph was built for. */
  project: string;

  /** The tsconfig the program was loaded from, in the dump's path vocabulary. */
  tsconfig: string;

  /** Evidence about the one program that produced everything below. */
  provenance: ITtscGraphDump.IProvenance;

  /**
   * The compiler's findings for the same generation that produced the facts.
   *
   * Empty means the program reported none. It does not mean they were not
   * collected — `provenance.capabilities` is what says whether they were.
   */
  diagnostics: ITtscGraphDump.IDiagnostic[];

  /** Every node the build recorded. */
  nodes: ITtscGraphDump.INode[];

  /** Every edge the build resolved. */
  edges: ITtscGraphDump.IEdge[];
}

export namespace ITtscGraphDump {
  /**
   * What a snapshot knows about its own origin.
   *
   * The graph's claim is that its nodes, edges, spans, and diagnostics all came
   * from one `Program`. Without this the claim is unprovable from the response:
   * a consumer could only re-read the disk afterwards and hope nothing moved,
   * which is not sound — a write that lands and reverts in between is invisible
   * to it, and a re-read proves what the disk says now, never what the checker
   * resolved against.
   *
   * This carries no source text. A digest is the opposite of inlining: it is
   * what lets a consumer prove byte-identity against text it read itself,
   * without the graph ever shipping that text.
   *
   * @evidence contracts/common.md#principled-implementation Schema, producer, universe and source digests ground one snapshot; separate artifact producer identifies facts outside its Program.
   * @evidence contracts/common.md#clear-and-simple-design Capabilities distinguish absent evidence from collected-empty evidence without version-specific field guesses.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown capabilities remain permitted rather than rejecting a newer producer by a hardcoded list.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain digest evidence, independent versions, capability extensibility and the second producer's scope.
   */
  export interface IProvenance {
    /**
     * The dump body's schema version, moved when a field is added, removed, or
     * redefined. Independent of the serve protocol's version: a dump written to
     * a file has a schema but never rode the protocol.
     */
    schemaVersion: number;

    /**
     * What this snapshot proves. A consumer degrades against this rather than
     * guessing from a field's emptiness, because an empty list and an
     * uncollected one look identical on the wire.
     *
     * The known members are `universe`, `sourceDigests`, `diskDigests`,
     * `diagnostics`, `docTags`, and `artifactNodes`, which the producer lists
     * only when it asked the project's configured plugins for artifact nodes.
     * The type stays `string[]` rather than a
     * union of those on purpose: a union would make `typia.assert` reject a
     * newer producer for naming a capability this client has not heard of,
     * turning "proves more than you know about" into a hard failure. An unknown
     * capability is exactly the case a consumer should ignore.
     */
    capabilities: string[];

    /** What built the snapshot. */
    producer: IProducer;

    /**
     * The second producer behind the artifact nodes, absent when the dump
     * carries none.
     *
     * Every other fact in this dump came from one Program. These did not: a
     * plugin parsed documents that Program never read, in a process of its own.
     * Saying so is what keeps the one-generation contract honest instead of
     * letting an overlay ride the same claim as the compiler's facts.
     */
    artifactProducer?: IProducer;

    /** The inputs that decide which files are in the program at all. */
    universe: IUniverse;

    /** One entry per file the program loaded, ordered by file. */
    sources: ISourceDigest[];
  }

  /**
   * Identifies the binary and the checker behind the facts.
   *
   * `tool` and `version` are separate because more than one binary can produce
   * a dump and they do not share a version line — the shipped `ttscgraph` is
   * stamped at release, the internal viewer tool is not versioned at all — so
   * folding the name in would hand a consumer that parses a version a tool
   * name.
   *
   * @evidence contracts/common.md#principled-implementation Tool, build version and TypeScript version identify distinct producer facts without conflating their version schemes.
   * @evidence contracts/common.md#clear-and-simple-design Three textual coordinates are sufficient for provenance and permit unversioned producer builds.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Empty build version remains an explicit supported producer state, not a fabricated release number.
   * @evidence contracts/common.md#meaningful-documentation Comments explain dev placeholders, unversioned tools and the checker version independently.
   */
  export interface IProducer {
    /** The producing binary's name, such as `ttscgraph`. */
    tool: string;

    /**
     * The producing binary's build version, as its `--version` prints it. A
     * local build reports the dev placeholder; a tool that carries no version
     * reports `""`.
     */
    version: string;

    /** The TypeScript version typescript-go implements. */
    typescript: string;
  }

  /**
   * The build universe: the inputs that decide which files the program
   * contains, as opposed to what is inside them. A change to any of them can
   * add or drop whole files, so a consumer reusing facts across snapshots must
   * treat a universe change as invalidating everything.
   *
   * @evidence contracts/common.md#principled-implementation Config digests and attributed roots represent the inputs deciding Program membership independently of source contents.
   * @evidence contracts/common.md#clear-and-simple-design Two collections separate configuration content from root attribution instead of duplicating whole sources.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing configured root remains part of the universe rather than disappearing from invalidation evidence.
   * @evidence contracts/common.md#meaningful-documentation Native documentation explains why compiler options and currently missing roots remain build inputs.
   */
  export interface IUniverse {
    /**
     * The tsconfig chain — the project's config and everything it extends.
     *
     * It stays an input regardless of what any source contains: compiler
     * options change the meaning of code the checker resolves without any
     * source file changing.
     */
    configs: IFileDigest[];

    /**
     * The resolved root file set, one entry per (config, file) pair. A root a
     * config names but that does not exist is still listed: its absence is part
     * of the fingerprint, and creating it later changes the program.
     */
    roots: IRootFile[];
  }

  /**
   * A root file attributed to the config that named it.
   *
   * @evidence contracts/common.md#principled-implementation Config and file form the attribution pair, permitting one root to be named by multiple configurations.
   * @evidence contracts/common.md#clear-and-simple-design Two portable coordinates express attribution without repeating config content.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Root identity is not collapsed to a basename or guessed project owner.
   * @evidence contracts/common.md#meaningful-documentation Both member comments specify the dump path vocabulary and config ownership.
   */
  export interface IRootFile {
    /** The tsconfig that named this root, in the dump's path vocabulary. */
    config: string;

    /** The root file, in the dump's path vocabulary. */
    file: string;
  }

  /**
   * A file and the hex-encoded SHA-256 of its on-disk bytes.
   *
   * @evidence contracts/common.md#principled-implementation The file coordinate pairs with a content digest, distinguishing byte identity from file timestamps.
   * @evidence contracts/common.md#clear-and-simple-design One path and digest carry exactly the input witness needed by the build universe.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The contract names content hashing rather than treating size or quiet watchers as content identity.
   * @evidence contracts/common.md#meaningful-documentation Native comments identify path vocabulary and hexadecimal SHA-256 encoding.
   */
  export interface IFileDigest {
    /** In the dump's path vocabulary. */
    file: string;

    /** Hex-encoded SHA-256. */
    digest: string;
  }

  /**
   * The manifest entry for one source file the program loaded.
   *
   * Two digests, because "the bytes the checker read" and "the bytes on disk"
   * are not always the same string and a consumer needs to know which one it
   * compares against. They diverge when a source-preamble plugin injects text
   * ahead of the file before tsgo parses it, which a real plugin project does
   * on every build.
   *
   * @evidence contracts/common.md#principled-implementation Separate checker and disk digests preserve the distinction between transformed compiler text and raw source bytes.
   * @evidence contracts/common.md#clear-and-simple-design The manifest retains only file and two witnesses, leaving source text outside the wire protocol.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing raw bytes are an empty witness; augmented source does not receive a fabricated disk-equivalence claim.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain preamble divergence, capability gating and empty-digest meaning.
   */
  export interface ISourceDigest {
    /** In the dump's path vocabulary. */
    file: string;

    /**
     * Hex-encoded SHA-256 of the text the checker resolved against — the ground
     * truth for the facts. Every node, edge, and span attributed to this file
     * was computed from these bytes.
     */
    checkerDigest: string;

    /**
     * Hex-encoded SHA-256 of the file's on-disk bytes at snapshot time, or `""`
     * when it could not be read: it vanished mid-load, or it is a virtual
     * source with no on-disk identity.
     *
     * This is the one a consumer that opens the file itself can reproduce. When
     * it equals `checkerDigest`, a matching read proves byte-identity with the
     * facts. When it does not, the checker saw augmented text and that proof is
     * simply not available for this file — which is a thing to report, not to
     * paper over.
     *
     * Read it only when `provenance.capabilities` lists `diskDigests`. Without
     * that claim every one of these is empty because the producer never hashed
     * the disk, which is a different fact from a file that could not be read.
     */
    diskDigest: string;
  }

  /**
   * One compiler diagnostic from the generation that produced the facts.
   *
   * @evidence contracts/common.md#principled-implementation Coordinates, compiler code, severity and message describe the actual finding for the same graph generation.
   * @evidence contracts/common.md#clear-and-simple-design A self-contained diagnostic record avoids parsing codes and severity from prose.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Diagnostic categories are explicit wire values, not inferred from expected test output.
   * @evidence contracts/common.md#meaningful-documentation Native comments document one-based coordinates, diagnostic code and message without its code prefix.
   */
  export interface IDiagnostic {
    /** In the dump's path vocabulary. */
    file: string;

    /** 1-based line. */
    line: number;

    /** 1-based column. */
    column: number;

    /** The TypeScript diagnostic code, such as 2322. */
    code: number;

    /** Whether the finding fails a build. */
    category: "error" | "warning";

    /** The diagnostic text, without the code prefix. */
    message: string;
  }

  /**
   * A node as the builder sends it: the graph node, minus the file paths inside
   * its spans, which the loader puts back from the node's own `file`.
   *
   * A node's declaration span is in the node's file, always — the path in the
   * span was the same string a second time, once per node. It is the reader's
   * to reconstruct, and {@link TtscGraphMemory} does, so nothing downstream of
   * the loader sees a span without its file.
   *
   * @evidence contracts/common.md#principled-implementation Omit replaces memory-layer span and kind fields with native wire equivalents; parent applies only to published artifact containment.
   * @evidence contracts/common.md#clear-and-simple-design Shared node facts are inherited while repeated declaration paths are removed from wire spans.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Implementation spans may retain another file; they are not forced into declaration coordinates for compactness.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain reconstruction, artifact parent ownership and cross-file implementation spans.
   */
  export interface INode extends Omit<
    ITtscGraphNode,
    "evidence" | "implementation" | "kind"
  > {
    /** Node kind written by the native producer. */
    kind: TtscGraphDumpNodeKind;

    /**
     * The artifact containing this one, by id.
     *
     * Present only on an artifact node: a declaration's containment is
     * synthesized by the memory layer, and two producers of one relation would
     * put two answers in the graph. Absent at the top of a chain, and absent
     * rather than invented when the parent was not published.
     */
    parent?: string;

    /** Declaration span; its file is this node's `file`. */
    evidence?: ITtscGraphSpan;

    /**
     * Implementation span. This one keeps its file when it has one: an
     * implementation genuinely can live in another file from its declaration.
     */
    implementation?: ITtscGraphSpan;
  }

  /**
   * An edge as the builder sends it. Its span is in the file its `from` id
   * names — the id is `path#Qualified.Name:kind` — so the path rode the wire a
   * second time on every edge, and edges outnumber nodes several times over.
   *
   * @evidence contracts/common.md#principled-implementation Native kind and compact span replace memory fields while endpoint ids determine the expression's source file.
   * @evidence contracts/common.md#clear-and-simple-design Omit reuses relation fields and avoids repeating the source path inside each wire edge.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Compression preserves endpoint identity and actual evidence rather than shortening ids heuristically.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain id-based path reconstruction and the producer's relationship vocabulary.
   */
  export interface IEdge extends Omit<ITtscGraphEdge, "evidence" | "kind"> {
    /** Relationship kind written by the native producer. */
    kind: TtscGraphDumpEdgeKind;

    /** Expression span; its file is the one embedded in `from`. */
    evidence?: ITtscGraphSpan;
  }
}
