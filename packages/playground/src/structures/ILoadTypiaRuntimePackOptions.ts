/** Cancellation policy for `loadTypiaRuntimePack`. */
export interface ILoadTypiaRuntimePackOptions {
  /** Cancel the shared in-flight load. */
  signal?: AbortSignal;
}
