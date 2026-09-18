/** Per-call controls for a resident transform or update request. */
export interface TtscServiceRequestOptions {
  /** Abort this call before it receives a reply. */
  signal?: AbortSignal;
}
