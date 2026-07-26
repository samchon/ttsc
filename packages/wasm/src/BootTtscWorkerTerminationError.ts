/**
 * A boot failure that requires replacing the current Web Worker.
 *
 * Once `go.run` starts, JavaScript cannot stop that Go runtime. Retrying the
 * same API name in the same Worker would install a new readiness bridge that
 * the stale runtime could invoke, so `bootTtsc` terminally rejects later boots
 * until the caller terminates the Worker.
 */
export class BootTtscWorkerTerminationError extends Error {
  public static readonly CODE = "TTSC_WASM_WORKER_TERMINATION_REQUIRED";

  public readonly apiName: string;
  public readonly code = BootTtscWorkerTerminationError.CODE;
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
