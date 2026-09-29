import type { ITtscFileQuery } from "./ITtscFileQuery";

/**
 * Request shape for `getNodeAtPosition`, `getTypeAtPosition`,
 * `getSymbolAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Extending the shared file query adds the native byte-offset selector without
 *   duplicating snapshot/file identity. The native boundary validates finite
 *   integer bounds before converting JavaScript numbers to Go byte offsets.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The file query owns snapshot and path selection; this extension adds only
 *   the byte coordinate shared by syntax, type and symbol endpoint handlers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The native coordinate system is explicit rather than repaired by guessing
 *   that a JavaScript character index equals an offset into UTF-8 source.
 * @evidence contracts/common.md#meaningful-documentation
 *   Member JSDoc gives the accepted interval and explains the caller's UTF-16
 *   conversion responsibility, following the documentation skill's units rule.
 */
export interface ITtscPositionQuery extends ITtscFileQuery {
  /**
   * Integer byte offset into the file's source text. It must satisfy `0 <= position <
   * sourceText's UTF-8 byte length`; the offset immediately after the final
   * byte is out of range. JS callers with a UTF-16 line/character pair must
   * resolve it to a byte offset first.
   */
  position: number;
}
