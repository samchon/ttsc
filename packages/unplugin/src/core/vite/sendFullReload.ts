import type { ViteDevServerLike } from "./ViteDevServerLike";

/**
 * Deliver one full-reload so connected clients refetch the invalidated
 * importers. The channels differ across Vite majors (`ws`, deprecated `hot`,
 * per-environment `hot`); the first one that accepts the payload wins.
 */
export function sendFullReload(server: ViteDevServerLike): void {
  for (const channel of [
    server.ws,
    server.hot,
    server.environments?.client?.hot,
  ]) {
    if (channel?.send === undefined) {
      continue;
    }
    try {
      channel.send({ path: "*", type: "full-reload" });
      return;
    } catch {
      // Try the next channel; an unsupported payload on one major must not
      // suppress delivery through another.
    }
  }
}
