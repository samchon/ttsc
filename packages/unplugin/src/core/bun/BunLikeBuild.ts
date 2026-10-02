import type { BunLoader } from "./BunLoader";

/**
 * Minimal subset of the Bun `BuildConfig` plugin build object.
 *
 * `onLoad` drives the source transform. Bun's bundler also exposes `onStart`
 * and `onEnd`, which bracket the shared plugin's build lifecycle. The runtime
 * plugin API omits those hooks, so plugin setup itself starts its one
 * process-scoped module-loading session.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional lifecycle hooks distinguish Bun's bundler from its runtime;
 *   onLoad carries source contents and the parser Bun must run afterward.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The structural subset includes only hooks and file ownership this adapter
 *   consumes, keeping bundler-specific data out of common transform options.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Hook presence represents an actual host capability, not a test identity.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs describe runtime omissions, in-memory file ownership
 *   and loader meaning; spaced members follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   BunLikeBuild only declares a shape; it has no filesystem, path or process
 *   operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   BunLikeBuild only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   BunLikeBuild only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   BunLikeBuild only declares a shape; it has no handle or retained state at
 *   runtime.
 */
export interface BunLikeBuild {
  /**
   * Build configuration exposed unchanged by Bun's bundler plugin builder.
   *
   * Runtime plugin builders do not supply `files`. Bun's bundler accepts an
   * in-memory file map whose values deliberately remain `unknown` here because
   * this adapter only needs to preserve ownership, not consume their contents.
   */
  config?: {
    files?: Readonly<Record<string, unknown>>;
  };

  /**
   * Register a callback for the start of a bundler build.
   *
   * Optional because `Bun.plugin()` runtime builders do not expose this hook.
   *
   * @evidence contracts/common.md#principled-implementation
   *   A zero-argument lifecycle callback can finish synchronously or return
   *   its promise; optionality preserves the runtime's absent build boundary.
   * @evidence contracts/common.md#clear-and-simple-design
   *   The hook names one build-start responsibility without a host mode option.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The signature exposes Bun's registration hook rather than replacing it.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose states the event and absence meaning; the tag separator and
   *   member spacing follow documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of onStart is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of onStart is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of onStart is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of onStart is declared here; the cost belongs to its
   *   implementation.
   */
  onStart?(callback: () => void | Promise<void>): void;

  /**
   * Register a callback for deterministic bundler-session teardown.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The optional callback can return teardown completion to a bundler that
   *   owns build boundaries; runtime plugin builders omit that capability.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One end hook complements start without embedding teardown policy here.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   This is supported callback registration rather than foreign mutation.
   * @evidence contracts/common.md#meaningful-documentation
   *   The native comment identifies teardown timing with a blank tag separator,
   *   while the parent describes runtime omissions per documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of onEnd is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of onEnd is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of onEnd is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of onEnd is declared here; the cost belongs to its
   *   implementation.
   */
  onEnd?(callback: () => void | Promise<void>): void;

  /**
   * Register a loader callback for files matching `filter`.
   *
   * The callback receives the file path and must return the transformed file
   * contents plus the `loader` Bun should apply next. Configured in-memory
   * files retain relative key spellings; ordinary disk files are normally
   * absolute. The `loader` matters most for the runtime path (`Bun.plugin`),
   * where Bun must be told the returned contents are still TypeScript so it
   * keeps transpiling them before execution.
   *
   * @evidence contracts/common.md#principled-implementation
   *   A regex selects module paths and the async result pairs TypeScript text
   *   with its parser; undefined permits a bundler's next loader to own a file.
   * @evidence contracts/common.md#clear-and-simple-design
   *   The signature keeps selection, delivered path and loader response at one
   *   registration boundary without prescribing transform internals.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The supported load hook represents host cooperation rather than patching
   *   its module loader.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native paragraphs explain relative in-memory keys and why the parser must
   *   accompany returned text; tag/member spacing follows documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of onLoad is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of onLoad is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of onLoad is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of onLoad is declared here; the cost belongs to its
   *   implementation.
   */
  onLoad(
    options: { filter: RegExp },
    loader: (args: {
      path: string;
    }) => Promise<{ contents: string; loader: BunLoader } | undefined>,
  ): void;
}
