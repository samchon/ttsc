import type { ViteDevServerLike } from "./ViteDevServerLike";
import type { ViteHotChannelLike } from "./ViteHotChannelLike";

/**
 * Deliver a full reload so every environment refetches the invalidated
 * importers.
 *
 * Under the environment API (Vite 6+) each environment owns its hot channel,
 * and a custom environment may carry a transport of its own, so each distinct
 * environment channel receives the payload, as Vite itself sends one to every
 * environment when an update needs a full reload. The server-level `ws` and
 * `hot` are then aliases of the client environment's channel and are not sent
 * to again. A Vite 5 server has one mixed graph and one client channel, spelled
 * `ws` or `hot` by major; the first of those that accepts the payload wins.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Environment channels are deduplicated by actual object identity; mixed-graph
 *   servers try ws/hot aliases until one accepts the full-reload protocol payload.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Recipient selection stays in the public operation while send isolates one
 *   transport attempt and its failure handling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Alternative channels are supported API spellings, and the '*' path is the
 *   full-reload message's protocol scope rather than a fixture-specific result.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain environment ownership and alias deduplication;
 *   helper failure prose and tag spacing follow documentation guidance.
 */
export function sendFullReload(server: ViteDevServerLike): void {
  const environments = Object.values(server.environments ?? {});
  if (environments.length === 0) {
    for (const channel of [server.ws, server.hot]) {
      if (send(channel)) return;
    }
    return;
  }
  const delivered = new Set<ViteHotChannelLike>();
  for (const environment of environments) {
    const channel = environment?.hot;
    if (channel === undefined || delivered.has(channel)) continue;
    delivered.add(channel);
    send(channel);
  }
}

/** Send one full-reload payload; `false` when the channel cannot take it. */
function send(channel: ViteHotChannelLike | undefined): boolean {
  if (channel?.send === undefined) return false;
  try {
    channel.send({ path: "*", type: "full-reload" });
    return true;
  } catch {
    // An unsupported payload on one channel must not suppress delivery
    // through another.
    return false;
  }
}
