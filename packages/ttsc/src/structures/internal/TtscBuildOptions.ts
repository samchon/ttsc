import type { TtscCommonOptions } from "./TtscCommonOptions";

/** Internal options for a TypeScript-Go project build. */
export interface TtscBuildOptions extends TtscCommonOptions {
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
