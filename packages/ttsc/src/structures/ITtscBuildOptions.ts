import type { ITtscCommonOptions } from "./ITtscCommonOptions";

/** Options for a project build through the JS `ttsc` API. */
export interface ITtscBuildOptions extends ITtscCommonOptions {
  /** Project config file to compile. Relative paths are resolved from `cwd`. */
  tsconfig?: string;
  /**
   * Emit override for the current call.
   *
   * - `true`: force file writes even when the project has `noEmit`.
   * - `false`: force diagnostics/check-only behavior.
   * - `undefined`: follow the resolved tsconfig exactly.
   */
  emit?: boolean;
  /** Per-call TypeScript-Go `outDir` override. */
  outDir?: string;
  /** Suppress summary banners from ttsc/native sidecars. Defaults to `true`. */
  quiet?: boolean;
}
