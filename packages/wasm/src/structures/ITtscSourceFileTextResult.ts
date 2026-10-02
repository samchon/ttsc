/**
 * Payload inside `ITtscResult.result` for `getSourceFileText`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A required text field mirrors the native successful response; missing files
 *   use the error envelope rather than overloading an empty source string.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The selected file's text is the only payload field; request identity and
 *   error status remain in the existing request and transport envelope.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Text comes from the retained program, without substituting the caller's
 *   editor buffer or a separately loaded approximation of the snapshot.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc names the endpoint and retained-program provenance, following
 *   the documentation skill's rule to explain the facts needed by a consumer.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscSourceFileTextResult is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscSourceFileTextResult is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscSourceFileTextResult is a data interface and coordinates no shared or repeated computation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscSourceFileTextResult is a data interface and performs no native filesystem, path or process operation.
 */
export interface ITtscSourceFileTextResult {
  /** Current source text held by the snapshot's program. */
  text: string;
}
