import type { ITtscSymbolInfo } from "./ITtscSymbolInfo";

/**
 * Payload inside `ITtscResult.result` for `getSymbolAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The nullable symbol follows native pointer JSON encoding, keeping successful
 *   absence distinct from a failed query envelope.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A nullable symbol field holds the lookup outcome; reusable symbol metadata
 *   and transport failure are represented separately without another status flag.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Absence is explicit rather than filled with a guessed identifier or symbol.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names the envelope and null meaning, following the documentation
 *   skill's requirement to explain absence rather than repeat the field type.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscSymbolAtPositionResult is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscSymbolAtPositionResult is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscSymbolAtPositionResult is a data interface and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscSymbolAtPositionResult is a data interface and performs no native filesystem, path or process operation.
 */
export interface ITtscSymbolAtPositionResult {
  /** `null` when no touching token has an associated symbol. */
  symbol: ITtscSymbolInfo | null;
}
