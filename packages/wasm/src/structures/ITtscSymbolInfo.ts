import type { ITtscSymbolDeclaration } from "./ITtscSymbolDeclaration";

/** Symbol shape returned by `getSymbolAtPosition`. */
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
