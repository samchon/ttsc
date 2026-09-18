import { GoBuildCacheCoordination } from "./GoBuildCacheCoordination";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * Run one Go build under a cross-process cache lease when ttsc owns the cache.
 *
 * The lease is published before checking maintenance. A maintenance process
 * that arrived first keeps its intent visible, so this builder withdraws and
 * retries; one that arrives second sees the lease and yields. That ordering
 * closes the scan/start race without serializing independent Go builds.
 */
export function withGoBuildCacheLease<T>(
  root: string,
  managed: boolean,
  callback: (cacheRoot: string) => T,
): T {
  if (!managed) {
    return callback(root);
  }
  const cacheRoot = GoBuildCacheCoordination.canonicalGoBuildCacheRoot(root);
  const started = Date.now();
  for (;;) {
    const lease = GoBuildCacheCoordination.createGoBuildCacheCoordinationRecord(
      cacheRoot,
      GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR,
    );
    const maintenance = GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(
      cacheRoot,
      GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR,
      Date.now(),
    );
    if (maintenance.length === 0) {
      try {
        if (!lease.startHeartbeat()) {
          throw new Error(
            `ttsc: unable to start Go build cache lease heartbeat at ${cacheRoot}`,
          );
        }
        return callback(cacheRoot);
      } finally {
        lease.finish();
      }
    }
    lease.finish();
    if (Date.now() - started > PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_STEAL_MS) {
      throw new Error(
        `ttsc: timed out waiting for Go build cache maintenance at ${cacheRoot}`,
      );
    }
    PluginBuildLockProtocol.sleepSync(GO_BUILD_CACHE_COORDINATION_POLL_MS);
  }
}

const GO_BUILD_CACHE_COORDINATION_POLL_MS = 25;
