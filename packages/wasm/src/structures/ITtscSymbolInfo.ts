import type { ITtscSymbolDeclaration } from "./ITtscSymbolDeclaration";

/**
 * Symbol shape returned by `getSymbolAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Names, flags and declaration projections match the native checker result;
 *   separate displayed text avoids confusing raw internal names with presentation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The declaration cap is the host's response-size policy, with the original
 *   total retained rather than pretending the shortened list is complete.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc explains internal naming, printing and capped versus total declarations,
 *   following the documentation skill's concrete context guidance.
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
