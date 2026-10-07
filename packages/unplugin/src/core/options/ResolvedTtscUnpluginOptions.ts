import type { ITtscProjectPluginConfig } from "ttsc";

import type { TtscUnpluginCompilerOptionsJson } from "./TtscUnpluginCompilerOptionsJson";

/**
 * Fully-resolved plugin options with all defaults applied.
 *
 * Produced by `resolveOptions`; consumed internally by the transform pipeline.
 * The compiler overlay is always present. An absent project requests discovery;
 * an absent plugin override preserves project-owned selection. An absent source
 * root uses the selected config's directory; it never changes plugin config origin.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A required overlay and optional project/plugin overrides match resolveOptions:
 *   empty overlay is normalized while omission retains discovery semantics.
 * @evidence contracts/common.md#clear-and-simple-design
 *   This internal boundary carries only the resolved choices the transform uses.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Optional overrides preserve supported caller choices instead of inventing
 *   a fallback project or replacing the compiler's plugin selection policy.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states which field is normalized and why omissions remain.
 *   Spaced member comments describe each choice using documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Normalization preserves the caller's native project-path spelling;
 *   project selection resolves relative paths against process.cwd. Undefined
 *   remains discovery, without imposing separators or filesystem case policy.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ResolvedTtscUnpluginOptions only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ResolvedTtscUnpluginOptions only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ResolvedTtscUnpluginOptions only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface ResolvedTtscUnpluginOptions {
  /** Compiler-options overlay applied on top of the discovered tsconfig. */
  compilerOptions: TtscUnpluginCompilerOptionsJson;

  /**
   * Resolved plugin list; mirrors the semantics of
   * `TtscUnpluginOptions.plugins`.
   */
  plugins?: readonly ITtscProjectPluginConfig[] | false;

  /** Resolved path to the project tsconfig, or `undefined` to auto-discover. */
  project?: string;

  /** Explicit source-root spelling, resolved at delivery; absent uses config directory. */
  projectRoot?: string;
}
