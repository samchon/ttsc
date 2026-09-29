import type { ITtscSymbolInfo } from "./ITtscSymbolInfo";

/**
 * Payload inside `ITtscResult.result` for `getSymbolAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The nullable symbol follows native pointer JSON encoding, keeping successful
 *   absence distinct from a failed query envelope.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Absence is explicit rather than filled with a guessed identifier or symbol.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names the envelope and null meaning, following the documentation
 *   skill's requirement to explain absence rather than repeat the field type.
 */
export interface ITtscSymbolAtPositionResult {
  /** `null` when no touching token has an associated symbol. */
  symbol: ITtscSymbolInfo | null;
}
