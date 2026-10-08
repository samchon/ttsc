import type { TtscTransformCache } from "../transform/cache/TtscTransformCache";
import { createTransformCacheLease } from "../transform/cache/createTransformCacheLease";
import { resetTtscTransformCache } from "../transform/cache/resetTtscTransformCache";

/**
 * Own Vite container identities and the build cache's session boundary.
 *
 * A replacement container may start before its predecessor ends. Only
 * registered identities decrement ownership; the last serve end resets, an
 * ordinary build releases its grace lease, and a watching build retains until
 * watcher close. Closing replaces the identity set so a late end cannot
 * decrement below zero. An unstarted end still performs the original idle
 * action when no owner exists.
 *
 * Server watching is disabled only by null; build watching requires a non-null
 * value. Configuration retains the resolved object and reads its settled modes
 * again at each start, after later configResolved hooks may have mutated it.
 * This does not reset existing ownership. Poller disposal and delivery remain
 * caller-owned.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Stable container identity prevents an old end from releasing a replacement.
 *   Start refreshes modes from the retained resolution after host hooks settle;
 *   watch registration, delivery admission and polling consume those same modes.
 *   The first ordinary build acquires one lease and its final end releases it;
 *   serve and watching-build resets retain their distinct actual boundaries.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One mode tuple, weak owner set and count govern the existing cache lease.
 *   The end result tells the caller when its separate pollers may be disposed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Uses the actual cache reset and lease, without a substituted backend or
 *   fabricated generation. Grace does not certify input or notification validity.
 * @evidence contracts/common.md#meaningful-documentation
 *   Prose explains overlap, unstarted and late ends, mode defaults and effect
 *   ownership without claiming installed Vite or native capture verification.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This controller interprets host lifecycle values and object identities;
 *   native watcher/probe disposal and timer scheduling remain delegated owners.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Configuration and identity membership updates avoid generation scans. Idle
 *   serve ends and watcher close delegate reset over cached promises; ordinary
 *   release delegates grace scheduling and eventual reset to the cache lease.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Overlapping containers and ordinary-build grace share the same cache, whose
 *   delivery and pass owners still establish whether a generation can be reused.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The weak set does not retain owner objects, but owners must deliver matching
 *   ends to reduce the count. Close replaces bookkeeping. The delegated lease
 *   owns its unreferenced grace timer and cache reclamation. The latest resolved
 *   configuration stays reachable through one refresh closure until replaced
 *   or the controller is collected. There is no deadline
 *   for unresolved generations or delayed timer callbacks.
 */
export function createViteBuildLifecycle(cache: TtscTransformCache) {
  const lease = createTransformCacheLease(cache);
  let command: string | undefined;
  let watching = true;
  let buildWatching = false;
  let usePolling = false;
  let refreshModes = (): void => {};
  let owners = new WeakSet<object>();
  let lifecycles = 0;
  return {
    /** Current configured command; absent until the first resolution. */
    get command(): string | undefined {
      return command;
    },
    /** Serve notifications are enabled unless server.watch was exactly null. */
    get watching(): boolean {
      return watching;
    },
    /** Build phases repeat only when build.watch was non-nullish. */
    get buildWatching(): boolean {
      return buildWatching;
    },
    /** Explicit polling declared by the latest resolved server watch options. */
    get usePolling(): boolean {
      return usePolling;
    },
    /** Retain this resolution so later host hooks can settle its modes. */
    configure(config: {
      command: string;
      server?: { watch?: unknown };
      build?: { watch?: unknown };
    }): void {
      refreshModes = () => {
        command = config.command;
        const watch = config.server?.watch;
        watching = watch !== null;
        buildWatching = config.build?.watch != null;
        usePolling =
          typeof watch === "object" &&
          watch !== null &&
          "usePolling" in watch &&
          watch.usePolling === true;
      };
      refreshModes();
    },
    /** Register one container identity, acquiring only the first build lease. */
    start(owner: object): void {
      refreshModes();
      if (command !== undefined && !owners.has(owner)) {
        owners.add(owner);
        lifecycles += 1;
        if (lifecycles === 1 && command === "build" && !buildWatching) {
          lease.acquire();
        }
      }
    },
    /** End a known owner and return whether caller-owned pollers may close. */
    end(owner: object): boolean {
      if (owners.delete(owner)) lifecycles -= 1;
      if (lifecycles !== 0) return false;
      if (command === "serve") resetTtscTransformCache(cache);
      else if (!buildWatching) lease.release();
      return true;
    },
    /** Reset at watcher teardown and forget identities before any late end. */
    close(): void {
      owners = new WeakSet<object>();
      lifecycles = 0;
      resetTtscTransformCache(cache);
    },
  };
}
