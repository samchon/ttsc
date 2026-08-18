import { assertUnavailableNotificationsKeepThePersistentCache } from "../../internal/transform-project-cache";

/**
 * Verifies a generation with unregisterable watchers still validates.
 *
 * Pins samchon/ttsc#1223. Watcher health was folded into the generation's own
 * completeness flag, so a host whose `fs.watch` registration fails — an
 * inotify-exhausted dev server, a network filesystem, a sandbox that forbids the
 * Windows broker child — produced an entry that neither the narrow nor the
 * complete path would accept, and every module delivery re-ran a whole-project
 * compile. Losing notifications must cost the narrow path, not the cache.
 *
 * 1. Refuse every watch registration through the cache-owned filesystem seam.
 * 2. Deliver every module and assert exactly one whole-project compile.
 * 3. Assert an edited source, a new input, an edited out-of-walk graph member,
 *    and a removed input each still recompile, and that a steady project stops.
 */
export const test_transformttsc_unavailable_notifications_keep_the_persistent_cache =
  async () => {
    await assertUnavailableNotificationsKeepThePersistentCache();
  };
