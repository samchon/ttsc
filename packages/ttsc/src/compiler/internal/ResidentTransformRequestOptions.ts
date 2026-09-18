/** Per-request lifecycle controls for a resident transform host. */
export interface ResidentTransformRequestOptions {
  /** Abort this request. An in-flight abort retires the FIFO host. */
  signal?: AbortSignal;
}
