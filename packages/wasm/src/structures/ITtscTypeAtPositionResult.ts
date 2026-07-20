import type { ITtscTypeInfo } from "./ITtscTypeInfo";

/** Payload inside `ITtscResult.result` for `getTypeAtPosition`. */
export interface ITtscTypeAtPositionResult {
  /** `null` when no touching token has a type. */
  type: ITtscTypeInfo | null;
}
