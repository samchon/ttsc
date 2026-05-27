import type { ITtscTypeInfo } from "./ITtscTypeInfo";

/** Payload inside `ITtscResult.result` for `getTypeAtPosition`. */
export interface ITtscTypeAtPositionResult {
  /** `null` when the node has no associated type. */
  type: ITtscTypeInfo | null;
}
