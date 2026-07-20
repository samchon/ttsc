import type { ITtscSymbolInfo } from "./ITtscSymbolInfo";

/** Payload inside `ITtscResult.result` for `getSymbolAtPosition`. */
export interface ITtscSymbolAtPositionResult {
  /** `null` when no touching token has an associated symbol. */
  symbol: ITtscSymbolInfo | null;
}
