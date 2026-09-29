/**
 * Per-request lifecycle controls for a resident transform host.
 *
 * @evidence contracts/common.md#principled-implementation An optional AbortSignal represents caller cancellation, with omission leaving the live operation pending until reply or host retirement.
 * @evidence contracts/common.md#clear-and-simple-design Cancellation belongs to one request rather than the fixed startup record; the transport owns the shared FIFO consequence after enqueueing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The signal uses the supported cancellation interface and introduces no inferred deadline or fixture-dependent abort policy.
 * @evidence contracts/common.md#meaningful-documentation The native member comment states the otherwise nonobvious in-flight retirement consequence, following the documentation skill.
 */
export interface ResidentTransformRequestOptions {
  /** Abort this request. An in-flight abort retires the FIFO host. */
  signal?: AbortSignal;
}
