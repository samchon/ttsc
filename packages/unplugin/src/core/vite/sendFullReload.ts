import type { ViteDevServerLike } from "./ViteDevServerLike";
import type { ViteHotChannelLike } from "./ViteHotChannelLike";

/**
 * Attempt a full-reload protocol request on the selected host channels.
 *
 * Under the environment API (Vite 6+) each environment owns its hot channel,
 * and a custom environment may carry a transport of its own, so each distinct
 * present environment channel is attempted once by object identity, even if
 * that attempt throws. A nonempty environment population suppresses server
 * `ws`/`hot` fallback even if no environment channel exists. Without
 * environment entries, the server channels are tried until one send returns
 * without throwing. That return does not prove client receipt or refetch.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Environment attempts are deduplicated by object identity; servers without
 *   environment entries try ws/hot until send returns without throwing. The
 *   operation does not certify transport delivery or client reload completion.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Recipient selection stays in the public operation while send isolates one
 *   transport attempt and its failure handling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Alternative channels are supported API spellings, and the '*' path is the
 *   full-reload message's protocol scope rather than a fixture-specific result.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain environment ownership and alias deduplication;
 *   helper failure prose and tag spacing follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   E environment entries take O(E) enumeration and identity-set work, with
 *   O(C) distinct channel references and at most C host send calls. Host transport
 *   cost is delegated; the no-environment branch makes at most two attempts.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The local set shares one attempted effect across aliases of the same
 *   environment channel, including a failed attempt, not proof of one delivery.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The delivered set is local to the call.
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
