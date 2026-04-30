import type { ITtscCommonOptions } from "./ITtscCommonOptions";

export interface ITtscBuildOptions extends ITtscCommonOptions {
  /** Path to tsconfig.json. Default: `tsconfig.json`. */
  tsconfig?: string;
  /**
   * Emit override. `true` forces emit, `false` forces noEmit, `undefined`
   * follows tsconfig.
   */
  emit?: boolean;
  /** Override compilerOptions.outDir for this invocation. */
  outDir?: string;
  /** Suppress the per-call summary banner. Default: `true`. */
  quiet?: boolean;
  /** @internal Caller already ran diagnostics and accepts responsibility. */
  skipDiagnosticsCheck?: boolean;
  /** @internal Force `tsgo --listEmittedFiles` for caller-side output discovery. */
  forceListEmittedFiles?: boolean;
}
