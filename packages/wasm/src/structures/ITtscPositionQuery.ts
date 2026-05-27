import type { ITtscFileQuery } from "./ITtscFileQuery";

/** Request shape for `getNodeAtPosition`, `getTypeAtPosition`, `getSymbolAtPosition`. */
export interface ITtscPositionQuery extends ITtscFileQuery {
  /**
   * Byte offset into the file's source text. JS callers with a UTF-16
   * line/character pair must resolve it to a byte offset first.
   */
  position: number;
}
