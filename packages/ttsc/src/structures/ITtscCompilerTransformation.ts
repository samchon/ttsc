import type { ITtscCompilerDiagnostic } from "./ITtscCompilerDiagnostic";

/**
 * Result of a TypeScript source-to-source transformation operation.
 *
 * This mirrors `embed-typescript`'s `IEmbedTypeScriptTransformation` model.
 * Unlike {@link ITtscCompilerResult}, this contract is not an emit contract: the
 * `typescript` map must contain TypeScript source text, not generated
 * JavaScript, declaration files, or source maps.
 *
 * @evidence contracts/common.md#principled-implementation The discriminated union separates completed source transformation from failure and host exception; its TypeScript text map is distinct from emit output.
 * @evidence contracts/common.md#clear-and-simple-design Named result variants share advisory dependency types but retain outcome-specific requirements, allowing callers to narrow by type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source text and optional invalidation metadata describe actual producer outputs; the contract does not substitute emitted JavaScript for transformed TypeScript.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc distinguishes transformation from emit, then explains result and advisory-data semantics on their declarations; paragraphs, member spacing and tag separation follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
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
   *
   * @evidence contracts/common.md#principled-implementation Direct reference edges, universal globals/configs and resolver predicates preserve different input influences; consumers derive reachability and replay only the observed filesystem predicates.
   * @evidence contracts/common.md#clear-and-simple-design The graph separates realized references from candidate observations and proof failures so adapters can invalidate conservatively without attributing compiler reads to plugins.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or failed proofs remain refusals to reuse; neither an empty candidate map nor a guessed platform case policy fabricates compiler evidence.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains path vocabulary, global influence, optional legacy fields and the compiler-owned case policy; documented members and distinct paragraphs follow the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
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

    /**
     * Whether the compiler compared file names case-sensitively: the policy it
     * matched the project's root specs with. A host deciding the same
     * membership takes it rather than guessing from the platform, since the
     * compiler decides it from the filesystem it runs on. Absent from an
     * envelope written before it was reported.
     */
    useCaseSensitiveFileNames?: boolean;
  }

  /**
   * Predicate-preserving compiler filesystem proof for one lexical path.
   *
   * @evidence contracts/common.md#principled-implementation Independent optional predicates preserve what the compiler actually queried; file absence can coexist with directory presence, and ok-discriminated reads/realpaths distinguish failure from a successful value.
   * @evidence contracts/common.md#clear-and-simple-design A single observation collects distinct results for one lexical path without flattening them into ambiguous generic existence.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Omitted predicates make no assertion; a failed read is not replaced with a synthetic content hash or path.
   * @evidence contracts/common.md#meaningful-documentation Native member comments identify each compiler operation and its result shape, with blank lines between documented members and before acknowledgments as required by the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
   */
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

  /**
   * Version 3 source map from one transformed file's text back to the text it
   * was transformed from.
   *
   * `sources` are relative to the transformed file's directory, joined to
   * {@link sourceRoot} when one is set. `sourcesContent` carries the text each
   * source was transformed from, so a consumer can confirm the map describes
   * the text it holds before handing it on.
   *
   * @evidence contracts/common.md#principled-implementation The version-3 shape separates VLQ mappings, names and source identities; optional embedded source text allows consumers to compare the map's origin with their actual input.
   * @evidence contracts/common.md#clear-and-simple-design The standard source-map fields stay together as one transform artifact instead of introducing a competing custom mapping representation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Version 3 is the supported map format; absent source content remains absent rather than synthesized to make a consumer accept a map.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains mapping direction, sourceRoot resolution and embedded-content meaning, with documented member spacing and separate acknowledgment prose under the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
   */
  export interface ISourceMap {
    /** Always `3`. */
    version: 3;

    /** Base name of the transformed file. */
    file?: string;

    /** Prefix joined to every entry of {@link sources}. */
    sourceRoot?: string;

    /** Files the mappings point into. */
    sources: string[];

    /** Text of each source the transform read, or `null` when not supplied. */
    sourcesContent?: (string | null)[];

    /** Symbol names referenced by the mappings. */
    names: string[];

    /** Base64 VLQ mappings. */
    mappings: string;
  }

  /**
   * Successful source-to-source transformation result.
   *
   * A zero-status operation without error diagnostics can retain non-fatal
   * findings alongside its transformed source and advisory input metadata.
   *
   * @evidence contracts/common.md#principled-implementation Success preserves TypeScript text and optional non-error findings; dependency completeness and volatility remain independent producer declarations governing reuse, not inferred correctness.
   * @evidence contracts/common.md#clear-and-simple-design Required source text and optional maps/input metadata expose one generation without mixing emission or forcing plugins to implement narrower invalidation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Completeness is an explicit responsibility transfer; unknown or volatile inputs retain conservative behavior rather than gaining fabricated cache eligibility.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains source-map absence, host versus plugin inputs, completeness and volatility in separate paragraphs; member spacing and tag separation follow the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
   */
  export interface ISuccess {
    /** Indicates successful completion without error diagnostics. */
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
     * Source maps keyed like {@link typescript}, from each transformed file's
     * text back to the text it was transformed from.
     *
     * Optional: ttsc's own hosts supply one for every file whose text differs
     * from its source, and an executable sidecar may supply its own. A file
     * without an entry has no map, so a consumer that re-emits it cannot claim
     * one. Malformed entries are dropped.
     */
    sourceMaps?: Record<string, ISourceMap>;

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
     * Host-input paths for which the producer could not complete observation,
     * keyed by absolute native path.
     *
     * The reason records unavailable observation only. It does not excuse a
     * changed hash, changed physical identity, or contradictory observations.
     * Consumers validate every available witness before handling this refusal.
     */
    hostInputProofFailures?: Record<string, "observation-unavailable">;

    /**
     * Explicit refusal to claim complete producer observation. A producer
     * reports `false` when its observation channel or supported hooks could not
     * account for every input influencing this generation.
     *
     * This is a negative signal: absence asserts no completeness. Consumers
     * must establish reuse authority from the actual input witnesses and
     * producer protocol independently; this field never grants it.
     */
    observationsComplete?: false;

    /**
     * The state of every Go source directory the transform's plugins supplied
     * to their binaries, by absolute path: each plugin's module root and each
     * contributor's source, with the digest of the files the build keyed its
     * binary on, as the build read them, together with the environment a build
     * there is keyed on, its Go compiler, `go env`, and cgo's toolchain. ttsc's own sources, which change
     * only with ttsc itself, are not listed.
     *
     * A plugin's binary is keyed on its source and its environment, so every
     * transformed file is a function of these states as much as of
     * {@link hostInputs}, and a plugin edited in place, or built under another
     * `GOFLAGS` or Go toolchain, changes nothing else a consumer can see. A
     * consumer that caches the output proves each state still holds with the
     * build's own rule, `pluginSourceStateHolds` from the `ttsc/plugin-source`
     * entry, which reads the environment again before it refutes a state, and
     * observes each directory as a whole subtree. Absent when no plugin ran.
     */
    pluginSources?: Record<string, string>;

    /**
     * Transformed files (keyed like {@link typescript}) whose output depends on
     * non-file inputs (environment, time, network) as declared by the transform
     * plugin via the envelope's optional `volatile` list. No file-dependency
     * scheme can represent such inputs, so consumers must exclude these files
     * from caching instead of watching more files.
     */
    volatile?: string[];
  }

  /**
   * Source-to-source transformation result that completed unsuccessfully or
   * reported error diagnostics.
   *
   * @evidence contracts/common.md#principled-implementation Failure retains partial transformed source and mandatory findings together with any available generation metadata, so callers do not lose completed work or mistake it for success.
   * @evidence contracts/common.md#clear-and-simple-design The completed-failure payload mirrors success's advisory shapes while making diagnostics mandatory; serialized host exceptions remain a different variant.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Partial metadata is not promoted to a completeness claim, and partial text is not supplemented with expected fixture output.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states which outputs may be partial and refers each reused field to its authoritative semantics within the same type namespace; member and tag separation follow the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
   */
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

    /**
     * Source maps of the transformed files. Same shape and semantics as
     * {@link ISuccess.sourceMaps}.
     */
    sourceMaps?: Record<string, ISourceMap>;

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
     * Unavailable host-input observations; same contract as
     * {@link ISuccess.hostInputProofFailures}, including mutation refusal.
     */
    hostInputProofFailures?: Record<string, "observation-unavailable">;

    /**
     * Explicit observation incompleteness; same negative-only contract as
     * {@link ISuccess.observationsComplete}.
     */
    observationsComplete?: false;

    /** Plugin source states; same contract as {@link ISuccess.pluginSources}. */
    pluginSources?: Record<string, string>;

    /**
     * Volatile transformed files. Same shape and semantics as
     * {@link ISuccess.volatile}.
     */
    volatile?: string[];
  }

  /**
   * Unexpected host-level error during transformation.
   *
   * Error name, message, stack, causes, aggregate failures and enumerable
   * outcome data are preserved in a finite description.
   *
   * Repeated objects use `$ttscReference` JSON-pointer markers. Exceptional
   * scalars, accessors and failed inspection use `$ttscValue` markers. Getters
   * are not invoked, and foreign class internal slots are not copied.
   *
   * @evidence contracts/common.md#principled-implementation Unknown represents finite causal error descriptions and tagged exceptional values, while an optional classifier identifies recognized host/plugin origins without consumer message parsing.
   * @evidence contracts/common.md#clear-and-simple-design A separate exception variant avoids requiring unavailable source maps or diagnostics after abnormal host failure.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An unrecognized origin remains unknown; no recovery wrapper fabricates a completed transformation.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain finite causal serialization, reference/value markers and accessor limits alongside classifier meanings; list, member and tag spacing follow the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
   */
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

    /** Finite causal description of the value thrown by the ttsc host. */
    error: unknown;
  }
}
