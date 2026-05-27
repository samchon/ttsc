import type { ITtscNodeInfo } from "./ITtscNodeInfo";

/** Payload inside `ITtscResult.result` for `getNodeAtPosition`. */
export interface ITtscNodeAtPositionResult {
  /** `null` when no node covers the position. */
  node: ITtscNodeInfo | null;
}
