import type { ITtscCompilerDiagnostic } from "./ITtscCompilerDiagnostic";

/**
 * Result of a TypeScript source-to-source transformation operation.
 *
 * This mirrors `embed-typescript`'s `IEmbedTypeScriptTransformation` model.
 * Unlike {@link ITtscCompilerResult}, this contract is not an emit contract: the
 * `typescript` map must contain TypeScript source text, not generated
 * JavaScript, declaration files, or source maps.
 */
export type ITtscCompilerTransformation =
  | ITtscCompilerTransformation.ISuccess
  | ITtscCompilerTransformation.IFailure
  | ITtscCompilerTransformation.IException;

export namespace ITtscCompilerTransformation {
  /**
   * Host-owned reference graph of the transformed program, mirroring the
   * envelope's optional `graph` section.
   *
   * The graph is the language-semantic input bound of the transform under `tsc
   * --incremental` semantics: any symbol a file can reference is reachable
   * through its import/reference closure or is ambient. Bundler adapters
   * register, per transformed file `F`, the reachability closure of
   * {@link edges} from `F` together with {@link globals} and {@link configs}, so
   * persistent caches and watch graphs invalidate soundly without per-plugin
   * dependency reporting.
   *
   * Keys and values follow the same convention as {@link ISuccess.typescript}:
   * project-relative slash paths, falling back to absolute slash paths outside
   * the project root.
   */
  export interface IReferenceGraph {
    /**
     * Direct resolved references per file: imports, re-exports, `///
     * <reference>` targets, and type reference directives — type-only edges
     * included. Direct edges only; consumers compute transitive reachability
     * themselves.
     */
    edges: Record<string, string[]>;

    /**
     * Files contributing to the global scope (ambient declaration files, script
     * files, global augmentations, `typeRoots` entries). A change to any of
     * them can affect every file in the program.
     */
    globals: string[];

    /** The project tsconfig followed by its `extends` ancestry. */
    configs: string[];

    /**
     * Exact lexical filesystem inputs consulted by TypeScript-Go's module,
     * type-reference, and triple-slash path resolution, keyed by source file.
     * Hosts watch and prove these paths in addition to realized graph members.
     *
     * A host with nothing to report leaves the whole property out rather than
     * sending an empty map, so `undefined` and "no resolver input" are the same
     * observation on the wire and after decoding.
     */
    candidates?: Record<string, string[]>;

    /**
     * Automatic type discovery and resolution inputs that affect every source,
     * including effective type-root directory membership.
     */
    resolutionInputs?: string[];

    /**
     * Exact filesystem predicates observed while the compiler constructed this
     * graph. Each property is independent: `fileExists: false` and
     * `directoryExists: true` describe one stable directory and do not
     * conflict. Consumers re-run only the predicates present in an entry, so a
     * failed file candidate is never reinterpreted as generic path absence.
     */
    inputObservations?: Record<string, IInputObservation>;

    /**
     * Legacy SHA-256/null projection of compiler filesystem observations, keyed
     * in the same vocabulary as {@link edges}. Current consumers prefer
     * {@link inputObservations} for candidate predicates and retain this pair
     * for strict realized-file content validation.
     */
    inputHashes?: Record<string, string | null>;

    /** Compiler-time physical identities paired with {@link inputHashes}. */
    inputRealpaths?: Record<string, string | null>;

    /**
     * Why the compiler could not produce a trustworthy proof for a graph
     * member. Values are stable machine-readable reason codes such as
     * `content-changed` or `realpath-unavailable`; consumers use them only for
     * diagnostics and still treat the missing proof as authoritative refusal.
     */
    inputProofFailures?: Record<string, string>;
  }

  /** Predicate-preserving compiler filesystem proof for one lexical path. */
  export interface IInputObservation {
    /** Result returned by `GetAccessibleEntries`, preserving both name lists. */
    accessibleEntries?: {
      directories: string[];
      files: string[];
    };

    /** Result returned by `DirectoryExists`, when the compiler called it. */
    directoryExists?: boolean;

    /** Result returned by `FileExists`, when the compiler called it. */
    fileExists?: boolean;

    /** Result returned by `ReadFile`, including decoded-text content identity. */
    readFile?:
      | { ok: false }
      | {
          hash: string;
          ok: true;
        };

    /** Result returned by `Realpath` or captured beside a successful predicate. */
    realpath?:
      | { ok: false }
      | {
          ok: true;
          path: string;
        };

    /**
     * Result returned by `Stat`, using the compiler's file-versus-directory
     * view.
     */
    stat?: "directory" | "file" | "missing";
  }

  /** Successful source-to-source transformation result. */
  export interface ISuccess {
    /** Indicates that transformation completed without diagnostics. */
    type: "success";

    /** Non-fatal diagnostics reported during transformation. */
    diagnostics?: ITtscCompilerDiagnostic[];

    /**
     * Transformed TypeScript source text keyed by project-relative file path.
     *
     * Values are TypeScript source text, never JavaScript, declaration files,
     * or source maps. When no transform native source is configured, this map
     * contains the unmodified TypeScript files loaded by the TypeScript-Go
     * Program.
     */
    typescript: Record<string, string>;

    /**
     * Source files the transform consulted per transformed file, keyed the same
     * way as {@link typescript}. Each entry lists the project-relative or
     * absolute paths whose content influenced that output beyond the file
     * itself — e.g. the declaration files a type-driven code generator read.
     *
     * Optional: only present when the transform native source reported a
     * `dependencies` object in its stdout envelope. Bundler adapters use it to
     * register watch files so type-only imports participate in HMR
     * invalidation. ttsc passes the paths through verbatim.
     */
    dependencies?: Record<string, string[]>;

    /**
     * Transformed files (keyed like {@link typescript}) whose
     * {@link dependencies} entry the transform host declares **complete**: every
     * input beyond the file itself and the universal
     * {@link IReferenceGraph.configs} chain is listed there.
     *
     * The declaration narrows invalidation. For a listed file a consumer uses
     * `dependencies[F] ∪ graph.configs` instead of the union with the
     * host-owned `reach(graph.edges, F) ∪ graph.globals` bound, so a change to
     * a file the transform never consulted no longer re-runs it. Unlisted files
     * keep the union, so a mixed envelope composes per file.
     *
     * This is a responsibility transfer, not a hint: an omission makes the
     * consumer serve stale output, and that is a defect of the declaring plugin
     * rather than of the host. Producers list a file only when the reported set
     * is derived from what the transform actually consulted (a Checker-driven
     * generator's per-file consulted-declaration list). When several plugin
     * entries contribute to one file, the envelope's author may list it only if
     * every contributing entry declared its own list complete for it.
     *
     * The config chain a listed file keeps is {@link graph}'s, so a host that
     * declares completeness should stamp {@link graph} too; without it a listed
     * file retains no universal input at all.
     *
     * Ttsc's own hosts stamp it for what they can prove: their source-to-source
     * output is a syntactic re-print, so the built-in native host and the
     * linked-plugin host list a file once every linked plugin able to
     * contribute to it has declared its own contribution complete — which,
     * where no plugin is active at all, is every file. An executable sidecar
     * prints its own envelope and decides for itself.
     *
     * Optional, and never required for correctness: an envelope without this
     * field keeps the sound host-owned bound. A file that is both listed here
     * and in {@link volatile} keeps the union, since the two claims contradict
     * and the conservative one wins.
     */
    dependenciesComplete?: string[];

    /**
     * Host-owned reference graph of the transformed program.
     *
     * Optional: only present when the transform host stamped a `graph` section
     * into its stdout envelope (the built-in native host and the linked-plugin
     * host always do; external sidecars adopt through the driver SDK).
     * Malformed sections are dropped, never fatal — the field is advisory
     * invalidation metadata, not output.
     */
    graph?: IReferenceGraph;

    /**
     * Host-wide files consulted before the native transform starts, such as
     * JavaScript plugin descriptors and explicitly selected plugin config
     * files. Unlike {@link dependencies}, these affect every transformed file.
     * Bundler adapters register and validate them as universal inputs without
     * treating arbitrary unclassified project files as configuration.
     */
    hostInputs?: string[];

    /**
     * SHA-256 fingerprints captured by the plugin loader at the instant each
     * host input influenced this generation. Internal cache validators use
     * these to reject a result raced by a concurrent config/module change.
     */
    hostInputHashes?: Record<string, string | null>;

    /** Evaluation-time physical identities paired with {@link hostInputs}. */
    hostInputRealpaths?: Record<string, string | null>;

    /**
     * Transformed files (keyed like {@link typescript}) whose output depends on
     * non-file inputs (environment, time, network) as declared by the transform
     * plugin via the envelope's optional `volatile` list. No file-dependency
     * scheme can represent such inputs, so consumers must exclude these files
     * from caching instead of watching more files.
     */
    volatile?: string[];
  }

  /** Source-to-source transformation result that completed with diagnostics. */
  export interface IFailure {
    /** Indicates that transformation completed with diagnostics. */
    type: "failure";

    /**
     * Transformed or partially transformed TypeScript source text keyed by
     * project-relative file path.
     *
     * May be empty or partial when diagnostics prevented the transform native
     * source from completing its pass.
     */
    typescript: Record<string, string>;

    /** Diagnostics reported during transformation. */
    diagnostics: ITtscCompilerDiagnostic[];

    /**
     * Source files the transform consulted per transformed file. Same shape and
     * semantics as {@link ISuccess.dependencies}; may be partial when the
     * transform did not complete its pass.
     */
    dependencies?: Record<string, string[]>;

    /**
     * Files whose reported dependency list the host declares complete. Same
     * shape and semantics as {@link ISuccess.dependenciesComplete}; may be
     * partial when the transform did not complete its pass.
     */
    dependenciesComplete?: string[];

    /**
     * Host-owned reference graph. Same shape and semantics as
     * {@link ISuccess.graph}; may be absent when diagnostics prevented the host
     * from loading the program.
     */
    graph?: IReferenceGraph;

    /** Host-wide transform inputs; same contract as {@link ISuccess.hostInputs}. */
    hostInputs?: string[];

    /** Generation-time host-input fingerprints. */
    hostInputHashes?: Record<string, string | null>;

    /** Generation-time physical host-input identities. */
    hostInputRealpaths?: Record<string, string | null>;

    /**
     * Volatile transformed files. Same shape and semantics as
     * {@link ISuccess.volatile}.
     */
    volatile?: string[];
  }

  /** Unexpected host-level error during transformation. */
  export interface IException {
    /** Indicates that transformation could not complete normally. */
    type: "exception";

    /**
     * Optional classifier so embedders can branch on the failure mode without
     * pattern-matching error messages. Omitted when ttsc cannot determine the
     * origin. Treat as `"unknown"` when missing.
     *
     * - `"plugin"`: a native plugin sidecar crashed or exited non-zero.
     * - `"host"`: the TypeScript-Go host could not start (missing binary, cache
     *   lock, invalid config).
     * - `"unknown"`: any other host-level failure.
     */
    kind?: "plugin" | "host" | "unknown";

    /** Raw error thrown by the ttsc host. */
    error: unknown;
  }
}
