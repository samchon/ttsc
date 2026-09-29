/**
 * Payload inside `ITtscResult.result` for `getSourceFileText`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A required text field mirrors the native successful response; missing files
 *   use the error envelope rather than overloading an empty source string.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Text comes from the retained program, without substituting the caller's
 *   editor buffer or a separately loaded approximation of the snapshot.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc names the endpoint and retained-program provenance, following
 *   the documentation skill's rule to explain the facts needed by a consumer.
 */
export interface ITtscSourceFileTextResult {
  /** Current source text held by the snapshot's program. */
  text: string;
}
