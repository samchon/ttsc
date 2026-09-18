import type { ITtscProjectPluginConfig } from "ttsc";

import type { TtscUnpluginCompilerOptionsJson } from "./TtscUnpluginCompilerOptionsJson";

/**
 * Fully-resolved plugin options with all defaults applied.
 *
 * Produced by `resolveOptions`; consumed internally by the transform pipeline.
 * Every field is present and normalised; callers should not construct this type
 * directly.
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
