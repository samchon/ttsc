import { ITtscGraphEdge } from "./ITtscGraphEdge";
import { ITtscGraphNode } from "./ITtscGraphNode";
import { ITtscGraphSpan } from "./ITtscGraphSpan";

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
 * uses one schema-v6 coordinate relative to it: project files are ordinary
 * relative paths; same-filesystem siblings use `../` segments; package files
 * keep their full resolution context (including version/peer-store segments);
 * and a virtual compiler source stays `bundled:///…`. Raw absolute identities
 * are never emitted. A source on another drive or UNC share makes the producer
 * fail unless a future contract supplies a logical root for it.
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
     * The known members are `universe`, `sourceDigests`, `diskDigests`, and
     * `diagnostics`. The type stays `string[]` rather than a union of those on
     * purpose: a union would make `typia.assert` reject a newer producer for
     * naming a capability this client has not heard of, turning "proves more
     * than you know about" into a hard failure. An unknown capability is
     * exactly the case a consumer should ignore.
     */
    capabilities: string[];

    /** What built the snapshot. */
    producer: IProducer;

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

  /** A root file attributed to the config that named it. */
  export interface IRootFile {
    /** The tsconfig that named this root, in the dump's path vocabulary. */
    config: string;

    /** The root file, in the dump's path vocabulary. */
    file: string;
  }

  /** A file and the hex-encoded SHA-256 of its on-disk bytes. */
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

  /** One compiler diagnostic from the generation that produced the facts. */
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
   */
  export interface INode extends Omit<
    ITtscGraphNode,
    "evidence" | "implementation"
  > {
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
   */
  export interface IEdge extends Omit<ITtscGraphEdge, "evidence"> {
    /** Expression span; its file is the one embedded in `from`. */
    evidence?: ITtscGraphSpan;
  }
}
