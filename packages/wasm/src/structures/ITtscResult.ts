/**
 * Envelope returned by asynchronous `ITtscApi` operations.
 *
 * `version` and `plugins` return their synchronous values directly.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The uniform exit-code/stream/payload shape mirrors the native JavaScript
 *   bridge, with structured JSON separate from plugin output streams.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One envelope separates status, two output channels and structured payload
 *   text, leaving endpoint-specific DTOs outside the transport representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A nonzero code remains visible; empty payload text is not replaced with a
 *   fabricated success object or interpreted as evidence that the call succeeded.
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate JSDoc paragraphs distinguish asynchronous envelopes from direct
 *   values; members explain channels, following the documentation skill's guidance.
 */
export interface ITtscResult {
  /** Exit code. 0 = success, 2 = compiler/config/usage error, 3 = runtime error. */
  code: number;

  /** Invocation-owned plugin stdout; project/query endpoints use an empty string. */
  stdout: string;

  /** Plugin stderr or a project/query failure message; distinct from host.stderr capture. */
  stderr: string;

  /**
   * For project and snapshot endpoints, the JSON-encoded structured result. For the
   * plugin endpoint, this is empty. The plugin's own output sits in
   * stdout/stderr. Use `parseResult<T>` to deserialize.
   */
  result: string;
}
