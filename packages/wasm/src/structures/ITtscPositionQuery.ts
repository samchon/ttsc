import type { ITtscFileQuery } from "./ITtscFileQuery";

/**
 * Request shape for `getNodeAtPosition`, `getTypeAtPosition`,
 * `getSymbolAtPosition`.
 */
export interface ITtscPositionQuery extends ITtscFileQuery {
  /**
   * Byte offset into the file's source text. It must satisfy `0 <= position <
   * sourceText's UTF-8 byte length`; the offset immediately after the final
   * byte is out of range. JS callers with a UTF-16 line/character pair must
   * resolve it to a byte offset first.
   */
  position: number;
}
