import type { ITtscSymbolInfo } from "./ITtscSymbolInfo";

/** Payload inside `ITtscResult.result` for `getSymbolAtPosition`. */
export interface ITtscSymbolAtPositionResult {
  /** `null` when the node has no associated symbol. */
  symbol: ITtscSymbolInfo | null;
}
