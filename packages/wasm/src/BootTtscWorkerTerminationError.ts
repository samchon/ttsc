/**
 * A boot failure that requires replacing the current Web Worker.
 *
 * Once `go.run` starts, JavaScript cannot stop that Go runtime. Retrying the
 * same API name in the same Worker would install a new readiness bridge that
 * the stale runtime could invoke, so `bootTtsc` terminally rejects later boots
 * until the caller terminates the Worker.
 *
 * @evidence contracts/common.md#principled-implementation
 *   An Error subclass carries a stable machine-readable code, API identity and
 *   original cause so the owner can replace the Worker rather than parse prose.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One error identity groups the terminal discriminator, API slot and cause;
 *   Worker replacement remains the caller's responsibility, outside this value.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The error exposes the runtime's terminal ownership limit rather than hiding
 *   it under retries that would reuse a stale global readiness bridge.
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate JSDoc paragraphs explain the failure and why replacement is required;
 *   members explain identity and cause, following the documentation skill.
 */
export class BootTtscWorkerTerminationError extends Error {
  /** Stable discriminator for Worker-replacement handling. */
  public static readonly CODE = "TTSC_WASM_WORKER_TERMINATION_REQUIRED";

  /** Global API bridge whose Go runtime has already started. */
  public readonly apiName: string;

  /** Instance discriminator shared with the class constant. */
  public readonly code = BootTtscWorkerTerminationError.CODE;

  /** Original cancellation, startup or runtime failure. */
  public override readonly cause: unknown;

  public constructor(apiName: string, cause: unknown) {
    const causeMessage =
      cause instanceof Error ? cause.message : String(cause ?? "boot failed");
    super(
      `[${BootTtscWorkerTerminationError.CODE}] ${causeMessage} bootTtsc: the ${apiName} Go runtime already started; terminate and replace this Worker before retrying.`,
    );
    this.name = "BootTtscWorkerTerminationError";
    this.apiName = apiName;
    this.cause = cause;
  }
}
