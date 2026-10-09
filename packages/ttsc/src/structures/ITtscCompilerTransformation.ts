import type { ITtscCompilerDiagnostic } from "./ITtscCompilerDiagnostic";

/**
 * Result of a TypeScript source-to-source transformation operation.
 *
 * Unlike {@link ITtscCompilerResult}, this contract is not an emit contract: the
 * `typescript` map carries producer-reported source text rather than compiler
 * emit artifacts. The builtin producer returns loaded non-declaration source
 * files' text, including JavaScript inputs when admitted by the program; source
 * maps are separate advisory payloads, not entries in that text map.
 *
 * @evidence contracts/common.md#principled-implementation The discriminated union separates completed source transformation from failure and host exception; its producer-reported source text map is distinct from emit output.
 * @evidence contracts/common.md#clear-and-simple-design Named result variants share advisory dependency types but retain outcome-specific requirements, allowing callers to narrow by type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source text and optional invalidation metadata describe actual producer outputs; the contract does not substitute emitted JavaScript for transformed TypeScript.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc distinguishes transformation from emit, then explains result and advisory-data semantics on their declarations; paragraphs, member spacing and tag separation follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidence contracts/portability.md#os-neutral-implementation Result variants carry producer-coordinate source keys, native input paths and filesystem observations through their shared advisory types without rebasing or inferring platform capabilities. The discriminant does not itself certify physical identity, freshness or a universal source-map URL interpretation; those boundaries are documented on the selected variant and metadata type.
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
   * The graph reports the loaded compiler program's resolved references, global
   * contributors, configuration ancestry and resolver observations. Bundler
   * adapters normally select the reachability closure of {@link edges} together
   * with {@link globals} and {@link configs}; an admitted complete dependency
   * declaration can narrow that graph selection. Resolver inputs, host inputs
   * and plugin source inputs remain separate invalidation lanes. The graph
   * alone does not certify every plugin's output dependencies or that the
   * reported filesystem state is still current.
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
   * @evidence contracts/portability.md#os-neutral-implementation Graph keys use the producer's cwd-relative slash spelling with absolute slash paths for outside-root or cross-volume inputs; this protocol spelling is distinct from reported native realpaths carried by inputRealpaths and observations, which can retain lexical fallback on native VFS errors. The reported compiler case policy governs compiler membership comparisons rather than an OS-name assumption; absent policy or proof does not establish native filesystem capabilities.
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
     * The native producer omits an empty candidate map. Absence describes no
     * reported source-owned candidates; it does not certify that resolution
     * consulted no filesystem input, including universal resolution inputs.
     */
    candidates?: Record<string, string[]>;

    /**
     * Automatic type discovery and resolution inputs that affect every source,
     * including effective type-root directory membership.
     */
    resolutionInputs?: string[];

    /**
     * Filesystem predicates recorded during construction and resolver replay
     * for this graph. Each property is independent: `fileExists: false` and
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

    /**
     * Compiler-time reported realpaths paired with {@link inputHashes}. Native
     * VFS resolution errors can return lexical spelling; presence alone does
     * not independently certify physical alias resolution.
     */
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
   * Predicate-preserving compiler filesystem observations for one lexical path.
   *
   * These reported query results are not an atomic filesystem snapshot or a
   * freshness certificate. The decoder rejects incompatible predicate sets;
   * consumers separately decide whether the reported inputs remain current.
   *
   * @evidence contracts/common.md#principled-implementation Independent optional predicates preserve what the compiler actually queried; file absence can coexist with directory presence, and ok-discriminated reads/realpaths distinguish failure from a successful value.
   * @evidence contracts/common.md#clear-and-simple-design A single observation collects distinct results for one lexical path without flattening them into ambiguous generic existence.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Omitted predicates make no assertion; a failed read is not replaced with a synthetic content hash or path.
   * @evidence contracts/common.md#meaningful-documentation Native member comments identify each compiler operation and its result shape, with blank lines between documented members and before acknowledgments as required by the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidence contracts/portability.md#os-neutral-implementation Member results preserve the compiler filesystem's file/directory predicates and accessible entry names; successful realpaths carry native absolute path spelling rather than URL or project-relative identity. Missing predicates and failed queries make no platform capability assertion, and a missing Stat result reflects the filesystem adapter's null result rather than independently proving physical absence.
   */
  export interface IInputObservation {
    /**
     * Actual native contributor/config predicates with their original raw-byte,
     * directory-member, link-entry or optional-file fingerprint semantics.
     * Version 1 never uses these digests as decoded compiler text hashes. Scope
     * preserves cache-only dependencies independently of watch topology.
     */
    nativePredicates?: {
      version: 1;
      kind: "file" | "directory" | "entry" | "optional-file";
      digest: string;
      identityStable: boolean;
      realpath: string | null;
      scope: "cache" | "watch";
    }[];

    /** Result returned by `GetAccessibleEntries`, preserving both name lists. */
    accessibleEntries?: {
      directories: string[];
      files: string[];
    };

    /** Result returned by `DirectoryExists`, when the compiler called it. */
    directoryExists?: boolean;

    /** Result returned by `FileExists`, when the compiler called it. */
    fileExists?: boolean;

    /** Result returned by `ReadFile`, hashing the compiler's returned text. */
    readFile?:
      | { ok: false }
      | {
          hash: string;
          ok: true;
        };

    /**
     * Adapter `Realpath` result or a query beside a successful predicate. A
     * nonempty native VFS fallback can retain the requested lexical spelling;
     * `ok: true` alone is not independent physical-resolution proof.
     */
    realpath?:
      | { ok: false }
      | {
          ok: true;
          path: string;
        };

    /**
     * Result returned by `Stat`, using the compiler's file-versus-directory
     * view. `missing` represents a null adapter result.
     */
    stat?: "directory" | "file" | "missing";
  }

  /**
   * Supported version-3 source-map payload for transformed source text.
   *
   * The native bundler consumer resolves `sources` with native path arithmetic
   * from the transformed module's directory and {@link sourceRoot}. This
   * supported contract is narrower than general source-map URL resolution.
   * `sourcesContent` can carry original text for an identity/content check; the
   * envelope decoder checks field shapes, not VLQ semantics or mapping
   * correspondence to the transformed text. String source names and an explicit
   * `names` array are required by this payload shape.
   *
   * @evidence contracts/common.md#principled-implementation The version-3 shape separates VLQ mappings, names and source identities; optional embedded source text allows consumers to compare the map's origin with their actual input.
   * @evidence contracts/common.md#clear-and-simple-design The standard source-map fields stay together as one transform artifact instead of introducing a competing custom mapping representation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Version 3 is the supported map format; absent source content remains absent rather than synthesized to make a consumer accept a map.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains mapping direction, sourceRoot resolution and embedded-content meaning, with documented member spacing and separate acknowledgment prose under the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidence contracts/portability.md#os-neutral-implementation The native adapter interprets sources/sourceRoot as filesystem path inputs anchored to the transformed module; this is not a promise to resolve arbitrary source-map URLs. SourcesContent is reported text, while physical source identity and native path interpretation belong to the consumer rather than to an OS-name guess or this type declaration.
   */
  export interface ISourceMap {
    /** Always `3`. */
    version: 3;

    /** Optional name associated with the transformed output. */
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
   * @evidence contracts/common.md#principled-implementation Success preserves reported source text and optional non-error findings; dependency completeness and volatility remain independent producer declarations governing reuse, not inferred correctness.
   * @evidence contracts/common.md#clear-and-simple-design Required source text and optional maps/input metadata expose one generation without mixing emission or forcing plugins to implement narrower invalidation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Completeness is an explicit responsibility transfer; unknown or volatile inputs retain conservative behavior rather than gaining fabricated cache eligibility.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains source-map absence, host versus plugin inputs, completeness and volatility in separate paragraphs; member spacing and tag separation follow the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
   * @evidence contracts/portability.md#os-neutral-implementation Source keys, dependency paths and native host/source-state observations carry producer coordinates across the protocol. Adapters own native spelling and identity; the representation does not infer filesystem case from an OS label.
   */
  export interface ISuccess {
    /** Indicates successful completion without error diagnostics. */
    type: "success";

    /** Non-fatal diagnostics reported during transformation. */
    diagnostics?: ITtscCompilerDiagnostic[];

    /**
     * Producer source text keyed by its reported source coordinate; adaptation
     * forwards the keys without independently rebasing them.
     *
     * This is source output, not an emitted-file map. The built-in native API
     * returns parsed text of non-declaration Program files, including any
     * source preamble. Linked hooks may mutate the AST before this read; that
     * lane does not reprint those mutations into file.Text(). Executable
     * sidecars supply their own source-text envelopes.
     */
    typescript: Record<string, string>;

    /**
     * Source maps keyed like {@link typescript}, from each transformed file's
     * text back to the text it was transformed from.
     *
     * Optional and producer-supplied: the built-in api-transform envelope has
     * no sourceMaps field. A file without an entry has no map, so a consumer
     * that re-emits it cannot claim one. Entries failing the decoder's
     * version/member-shape checks are dropped; admission does not independently
     * validate VLQ mappings or their correspondence to source/output text.
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
     * The declaration narrows the graph-derived lane. For a listed, nonvolatile
     * file the adapter keeps `dependencies[F] ∪ graph.configs` without adding
     * `reach(graph.edges, F) ∪ graph.globals`. Unlisted files keep that broader
     * graph set. Resolver candidates, host inputs and plugin-source inputs
     * remain independently selected universal influences, so this is not a
     * guarantee that every unrelated edit avoids rerunning a transform.
     *
     * This is a responsibility transfer, not a hint: an omission makes the
     * consumer serve stale output, and that is a defect of the declaring plugin
     * rather than of the host. Producers list a file only when the reported set
     * is derived from what the transform actually consulted (a Checker-driven
     * generator's per-file consulted-declaration list). When several plugin
     * entries contribute to one file, the envelope's author may list it only if
     * every contributing entry declared its own list complete for it.
     *
     * The graph-config chain comes from {@link graph}; without that section this
     * lane contributes no graph-config baseline. Independently reported host
     * and plugin-source inputs remain separate universal lanes.
     *
     * The built-in Program-text lane does not perform type-driven emit
     * lowering. Its SDK aggregation lists a file when every selected
     * preamble/program contributor declares completeness for it; with no
     * contributors every file is listed. This does not establish that mutated
     * ASTs were reprinted. An executable sidecar authors its own envelope and
     * declaration.
     *
     * Optional: omission keeps the broader graph-derived inputs when a graph is
     * available; missing graph evidence must not itself authorize reuse. A file
     * also listed in {@link volatile} does not gain narrowed graph inputs, and
     * remains subject to the consumer's volatile-output refusal.
     */
    dependenciesComplete?: string[];

    /**
     * Host-owned reference graph of the transformed program.
     *
     * Optional: only present when the transform host stamped a `graph` section
     * into its stdout envelope. The built-in Program-text lane computes it when
     * a Program is available; external sidecars may use the driver SDK. A
     * section failing the decoder's required member shapes is omitted rather
     * than promoted to a usable graph; shape admission is not complete native
     * generation proof.
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
     * Producer-reported generation-time SHA-256/null observations. Validators
     * compare available witnesses to refuse detected config/module drift;
     * sequential observations do not pin every byte consumed by evaluation or
     * certify all concurrent changes were observed.
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
     * there is keyed on, its Go compiler, `go env`, and cgo's toolchain. ttsc's
     * own sources, which change only with ttsc itself, are not listed.
     *
     * A plugin's binary is keyed on its source and its environment, so every
     * transformed file is a function of these states as much as of
     * {@link hostInputs}, and a plugin edited in place, or built under another
     * `GOFLAGS` or Go toolchain, changes nothing else a consumer can see. A
     * consumer that caches the output checks each state with the build's own
     * rule, `pluginSourceStateHolds` from the `ttsc/plugin-source` entry. That
     * owner selects files under the shared prune/omit policy and applies its
     * source/environment observation and refresh rules; this is not a
     * whole-subtree watcher or independent executable-byte proof. The field is
     * attached when the loader reports plugin-source states, rather than
     * certifying which hooks actually executed.
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
   * @evidence contracts/portability.md#os-neutral-implementation Producer source keys and native input/physical-path observations retain their reported coordinates; interpretation and native spelling belong to the producing and consuming adapters, not an OS-label case rule in this representation.
   */
  export interface IFailure {
    /** Indicates that transformation completed with diagnostics. */
    type: "failure";

    /**
     * Transformed or partially transformed TypeScript text keyed by the
     * producer source coordinate. Result adaptation forwards these keys without
     * independently rebasing them to the selected project root.
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
   * Unexpected host-level error during preparation, transformation or result
   * adaptation.
   *
   * Error name, message, stack, causes, aggregate failures and enumerable
   * outcome data are preserved in a finite description.
   *
   * Repeated objects use `$ttscReference` JSON-pointer markers. Source objects
   * shaped like reference or literal-object envelopes are escaped as `{
   * $ttscValue: "object", $ttscProperties: ... }`. Exceptional scalars,
   * accessors and failed inspection use `$ttscValue` markers. Error
   * serialization invokes no getters and copies no foreign class internal
   * slots; the separate kind classifier may read Error.message.
   *
   * @evidence contracts/common.md#principled-implementation Unknown carries finite causal descriptions and exceptional-value markers; the optional classifier labels recognized message families so consumers need not repeat its patterns, without proving the native failure cause.
   * @evidence contracts/common.md#clear-and-simple-design A separate exception variant avoids requiring unavailable source maps or diagnostics after abnormal host failure.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unrecognized patterns or unavailable message inspection remain unknown; no recovery wrapper fabricates a completed transformation.
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
     * Best-effort message-family classifier; it does not authenticate an origin
     * or establish that a process started or terminated. Treat missing values
     * as `"unknown"`.
     *
     * - `"plugin"`: recognized plugin/package/preparation, transform or Go
     *   toolchain message patterns.
     * - `"host"`: recognized ttsc/config/compiler-host message patterns.
     * - `"unknown"`: no recognized pattern or unavailable message inspection.
     */
    kind?: "plugin" | "host" | "unknown";

    /** Finite causal description of the value thrown by the ttsc host. */
    error: unknown;
  }
}
