import type { ITtscDiagnostic } from "./ITtscDiagnostic";

/**
 * Structured payload inside `ITtscResult.result` for `build` and `check`.
 *
 * `output` maps emit-destination paths (relative to `cwd`) to file contents. It
 * is empty when `check` is called without emit.
 */
export interface ITtscCompileResult {
  diagnostics?: ITtscDiagnostic[];
  output: Record<string, string>;
}
