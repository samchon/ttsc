import type { TtscTurbopackLoaderOptions } from "./TtscTurbopackLoaderOptions";

/**
 * Subset of the webpack loader context Turbopack provides to loaders wired
 * through `turbopack.rules`. The adapter uses the webpack-compatible loader
 * boundary: source string in, source string out, with `async()` for
 * asynchronous completion and `getOptions()` for the rule's `options` object.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Source/root paths and optional dependency/cache/error capabilities represent
 *   the webpack-compatible context Turbopack supplies; async owns completion.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The structural subset types only consumed hooks and avoids a webpack
 *   dependency for the standalone Turbopack loader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The shape exposes supported context methods rather than private worker internals.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain asynchronous completion and optional capability
 *   effects; spaced members and tag separation follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   resourcePath carries the host's absolute native module path, independently
 *   of its query; rootContext carries the native bundler scope or is absent for
 *   the adapter's cwd fallback. addDependency accepts native file spellings.
 *   These fields define the boundary without imposing a separator or case rule.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscTurbopackLoaderContext only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscTurbopackLoaderContext only declares a shape; it has no work to reuse
 *   at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscTurbopackLoaderContext only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscTurbopackLoaderContext {
  /**
   * Marks the loader asynchronous and returns the completion callback, which
   * takes the transformed content and its source map in webpack's loader form.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The returned callback carries error or content/map completion, matching
   *   the host's asynchronous loader protocol instead of returning a promise.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One acquisition operation exposes the completion channel without worker details.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   This is the host's supported asynchronous loader boundary.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose explains callback ownership and map form, separated from tags
   *   and neighboring members per documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of async is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of async is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of async is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of async is declared here; the cost belongs to its
   *   implementation.
   */
  async(): (error?: unknown, content?: string, sourceMap?: object) => void;

  /** Absolute native module path; a query is separate, so ?/# here are literal. */
  resourcePath: string;

  /**
   * The project root Turbopack resolves from, which anchors the watch bridge's
   * pinned scope (samchon/ttsc#1388).
   */
  rootContext?: string;

  /**
   * The rule's `options` object, when one was configured.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Optional options and an optional method preserve contexts with no rule
   *   override while sharing the adapter's existing options representation.
   * @evidence contracts/common.md#clear-and-simple-design
   *   The accessor reads one configuration boundary without exposing loader internals.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Caller options come from the rule, not a fixture-specific global lookup.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose names the producing rule and absence meaning, with blank tag
   *   and member separation following documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of getOptions is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of getOptions is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of getOptions is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of getOptions is declared here; the cost belongs to
   *   its implementation.
   */
  getOptions?(): TtscTurbopackLoaderOptions | undefined;

  /**
   * Register an additional file the transformed module depends on. Part of the
   * webpack loader context contract Turbopack implements; a registered file
   * enters Turbopack's `fileDependencies` set so editing it re-runs this loader
   * for the owning module under the host's dependency contract. When the host
   * omits this capability, the adapter cannot install that dependency hook.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Registering a file associates the module with that dependency's state;
   *   optionality exposes contexts where this dependency channel is unavailable.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One method communicates a file dependency without prescribing host watchers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   It is the supported loader dependency API rather than a watcher patch.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose explains re-run effects and optional capability, with tag/member
   *   spacing following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   The file parameter is a native dependency spelling supplied to the host,
   *   not a URL or query-qualified module ID. The signature preserves that
   *   boundary; resolution, identity and watch capability remain host-owned.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of addDependency is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of addDependency is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of addDependency is declared here; the cost belongs to
   *   its implementation.
   */
  addDependency?(file: string): void;

  /**
   * Toggle result cacheability. Part of the webpack loader context contract;
   * called with `false` when the ttsc plugin declared the module volatile
   * (output depends on non-file inputs), requesting that the host not replay
   * this loader result. When absent, that cacheability hook is unavailable.
   *
   * @evidence contracts/common.md#principled-implementation
   *   A boolean communicates whether host result replay is permitted, including
   *   volatile output whose dependencies cannot be represented as files.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One capability transfers cacheability policy without exposing host cache storage.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Marking volatile results uses the supported loader contract rather than
   *   fabricating dependencies to force invalidation.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose explains volatility and replay consequences, with separate
   *   tags and documented members per documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of cacheable is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of cacheable is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of cacheable is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of cacheable is declared here; the cost belongs to its
   *   implementation.
   */
  cacheable?(flag: boolean): void;

  /**
   * Report an error for the module without failing the loader run. Part of the
   * webpack loader context contract, which Turbopack's loader runtime provides.
   * The adapter uses it for a development compile failure before completing
   * with failed module source (see `turbopack`). Without it, that failure goes
   * through the asynchronous completion callback instead.
   *
   * @evidence contracts/common.md#principled-implementation
   *   An Error travels through the host's diagnostic channel separately from
   *   loader completion, allowing a failed module response in development.
   * @evidence contracts/common.md#clear-and-simple-design
   *   The capability distinguishes reporting a verdict from rejecting a worker run.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The host receives the actual failure through its supported diagnostic API.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native paragraphs explain diagnostic/completion separation and absence, with
   *   blank tag/member separators following documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of emitError is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of emitError is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of emitError is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of emitError is declared here; the cost belongs to its
   *   implementation.
   */
  emitError?(error: Error): void;
}
