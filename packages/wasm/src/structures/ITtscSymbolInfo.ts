import type { ITtscSymbolDeclaration } from "./ITtscSymbolDeclaration";

/**
 * Symbol shape returned by `getSymbolAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Names, flags and declaration projections match the native checker result;
 *   separate displayed text avoids confusing raw internal names with presentation.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Identity and presentation are separate, while bounded declaration sites reuse
 *   one site DTO and their total count explains a truncated projection directly.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The declaration cap is the host's response-size policy, with the original
 *   total retained rather than pretending the shortened list is complete.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains internal naming, printing and capped versus total declarations,
 *   following the documentation skill's concrete context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscSymbolInfo is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscSymbolInfo is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscSymbolInfo is a data interface and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscSymbolInfo is a data interface and performs no native filesystem, path or process operation.
 */
export interface ITtscSymbolInfo {
  /** Raw symbol name, including TypeScript's internal prefix markers. */
  name: string;

  /** Printed symbol, equivalent to TypeScript's `SymbolToString(s)`. */
  text?: string;

  /** Numeric `SymbolFlags` bitmask from TypeScript-Go. */
  flags: number;

  /** Up to 16 declaration sites; see `declarationCount` for the unclamped total. */
  declarations?: ITtscSymbolDeclaration[];

  /** Total number of declarations, even when `declarations` was clamped. */
  declarationCount?: number;
}
