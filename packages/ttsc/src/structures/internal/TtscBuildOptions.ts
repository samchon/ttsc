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
  /**
   * Invoke fix-capable check-stage plugins before the final no-emit check.
   * Source files may be rewritten; JavaScript/declaration emit stays disabled.
   */
  fix?: boolean;
  /**
   * Invoke format-capable check-stage plugins. Source files may be rewritten
   * with formatter-class edits (whitespace, punctuation, ordering); diagnostics
   * are not reported and JavaScript/declaration emit stays disabled. Mutually
   * exclusive with `--watch`, `--emit`, and single-file mode.
   */
  format?: boolean;
  /** Per-call TypeScript-Go `outDir` override. */
  outDir?: string;
  /** Suppress summary banners from ttsc/native sidecars. Defaults to `true`. */
  quiet?: boolean;
}
