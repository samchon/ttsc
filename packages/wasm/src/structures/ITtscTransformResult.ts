import type { ITtscDiagnostic } from "./ITtscDiagnostic";

/**
 * Structured payload inside `ITtscResult.result` for `transform`.
 *
 * `typescript` maps source file paths (relative to `cwd`) to their
 * post-transform TypeScript text — useful for playgrounds that want to show
 * the rewritten source before it is emitted.
 */
export interface ITtscTransformResult {
  diagnostics?: ITtscDiagnostic[];
  typescript: Record<string, string>;
}
