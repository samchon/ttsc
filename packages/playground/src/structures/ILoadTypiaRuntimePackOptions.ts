/** Cancellation and deadline policy for `loadTypiaRuntimePack`. */
export interface ILoadTypiaRuntimePackOptions {
  /** Cancel the shared in-flight load. */
  signal?: AbortSignal;
  /** Maximum fetch and JSON-read time. Defaults to 30 seconds. */
  timeoutMs?: number;
}
