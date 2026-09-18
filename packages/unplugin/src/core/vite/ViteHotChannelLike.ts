/** A channel that can deliver a full-reload event to connected clients. */
export interface ViteHotChannelLike {
  send?(payload: { path?: string; type: "full-reload" }): void;
}
