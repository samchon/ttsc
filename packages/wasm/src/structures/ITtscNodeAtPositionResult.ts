import type { ITtscNodeInfo } from "./ITtscNodeInfo";

/** Payload inside `ITtscResult.result` for `getNodeAtPosition`. */
export interface ITtscNodeAtPositionResult {
  /** `null` when no syntax token touches the position. */
  node: ITtscNodeInfo | null;
}
