/** A channel that can deliver a full-reload event to connected clients. */
export interface ViteHotChannelLike {
  /** Deliver one payload to connected clients. */
  send?(payload: { path?: string; type: "full-reload" }): void;
}
