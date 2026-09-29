import type { ITtscProjectPluginConfig } from "ttsc";

import type { TtscUnpluginCompilerOptionsJson } from "./TtscUnpluginCompilerOptionsJson";

/**
 * Fully-resolved plugin options with all defaults applied.
 *
 * Produced by `resolveOptions`; consumed internally by the transform pipeline.
 * The compiler overlay is always present. An absent project requests discovery;
 * an absent plugin override preserves project-owned selection.
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
}
