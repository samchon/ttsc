import type { ITtscDiagnostic } from "./ITtscDiagnostic";

/**
 * Payload inside `ITtscResult.result` for `getDiagnostics`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The required array matches the native endpoint's initialized result slice,
 *   unlike compile payloads where an absent diagnostics property is supported.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single initialized list represents the selection; messages reuse the
 *   compile diagnostic DTO and the transport status remains in its envelope.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Reusing the compiler diagnostic shape avoids a separate simplified schema
 *   that discards information to satisfy a particular UI.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc identifies the envelope and explains empty-result meaning,
 *   using the documentation skill's concrete context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscFountainDiagnosticsResult is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscFountainDiagnosticsResult is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscFountainDiagnosticsResult is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscFountainDiagnosticsResult {
  /** Messages selected by the query; an empty array means none were returned. */
  diagnostics: ITtscDiagnostic[];
}
