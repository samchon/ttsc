/**
 * Syntax-token shape returned by `getNodeAtPosition`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Numeric kind and byte ranges preserve TypeScript-Go's AST representation;
 *   a printable name and optional text make the JSON usable without that AST.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Kind, range and spelling are a flat token projection, without exposing
 *   parent links or mutable compiler nodes to the JavaScript consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Positions remain native byte offsets, without a guessed UTF-16 conversion
 *   or an invented source span for a particular token.
 * @evidence contracts/common.md#meaningful-documentation
 *   Members explain range units, endpoint inclusion and optional text. Native
 *   JSDoc follows the documentation skill's concrete usage-context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscNodeInfo is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscNodeInfo is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscNodeInfo is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscNodeInfo {
  /** Numeric `ast.Kind` from TypeScript-Go. */
  kind: number;

  /** Human-readable name of `kind`. */
  kindName: string;

  /**
   * Byte offset of the token's first byte (inclusive), after leading whitespace
   * and comments.
   */
  pos: number;

  /** Byte offset where the node ends (exclusive). */
  end: number;

  /** Source text covered by the node, when available. */
  text?: string;
}
