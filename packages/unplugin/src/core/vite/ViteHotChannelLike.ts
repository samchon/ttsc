/**
 * A channel that can deliver a full-reload event to connected clients.
 *
 * @evidence contracts/common.md#principled-implementation
 *   An optional send capability carries the full-reload protocol discriminant
 *   while leaving transport and connected-client ownership with Vite.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One structural operation suffices; websocket and custom transports share it.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The type describes message delivery rather than transport implementation mutation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose names payload ownership and member purpose, with description/tag
 *   separation following documentation guidance.
 */
export interface ViteHotChannelLike {
  /**
   * Deliver one payload to connected clients.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The literal full-reload discriminant and optional path match the reload
   *   message this adapter emits through an available channel.
   * @evidence contracts/common.md#clear-and-simple-design
   *   The method describes transport-neutral delivery without a websocket dependency.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The discriminant is a Vite protocol value, not an invented response for tests.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose states delivery responsibility and uses a blank tag separator
   *   as the documentation skill requires.
   */
  send?(payload: { path?: string; type: "full-reload" }): void;
}
