import { GoBuildCacheCoordination } from "./GoBuildCacheCoordination";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";

/**
 * Run one Go build under a cross-process cache lease when ttsc owns the cache.
 *
 * The lease is published before checking maintenance. A maintenance process
 * that arrived first keeps its intent visible, so this builder withdraws and
 * retries; one that arrives second sees the lease and yields. That ordering
 * closes the scan/start race without serializing independent Go builds.
 *
 * Protection assumes the coordination heartbeat stays within its freshness
 * grace; a later suspension or refresh failure is not process-absence proof.
 *
 * @evidence contracts/common.md#principled-implementation Publishing before scanning maintenance makes either ordering visible to the other participant under the coordination freshness premise; startup acknowledgment does not prove continued heartbeat progress, and lease cleanup covers the scan and callback.
 * @evidence contracts/common.md#clear-and-simple-design Unmanaged caches bypass ttsc coordination; one retry loop owns managed lease acquisition, maintenance negotiation and finally release.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Maintenance uses the shared live-record protocol instead of assuming no other process writes the cache; contention retries address the actual arbitration requirement.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the two possible arrival orders and why independent builds remain concurrent, with distinct acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Managed roots are physically canonicalized and Node-backed lease/heartbeat operations isolate native coordination details.
 * @evidence contracts/performance.md#efficient-algorithms Contention waits sleep between directory-record scans; when maintenance is absent the callback executes without serializing separate builders behind one global build lock.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A lease protects an individual effectful build; equivalent binary reuse belongs to the outer plugin-key build owner.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each iteration owns at most one record/heartbeat; finally releases it on scan failure, startup failure, callback return or throw before retrying or leaving the wait.
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
  const started = performance.now();
  for (;;) {
    const lease = GoBuildCacheCoordination.createGoBuildCacheCoordinationRecord(
      cacheRoot,
      GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR,
    );
    try {
      const maintenance =
        GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(
          cacheRoot,
          GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR,
          Date.now(),
        );
      if (maintenance.length === 0) {
        if (!lease.startHeartbeat()) {
          throw new Error(
            `ttsc: unable to start Go build cache lease heartbeat at ${cacheRoot}`,
          );
        }
        return callback(cacheRoot);
      }
    } finally {
      lease.finish();
    }
    if (
      performance.now() - started >
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_WAIT_MS
    ) {
      throw new Error(
        `ttsc: timed out waiting for Go build cache maintenance at ${cacheRoot}`,
      );
    }
    PluginBuildLockProtocol.sleepSync(GO_BUILD_CACHE_COORDINATION_POLL_MS);
  }
}

const GO_BUILD_CACHE_COORDINATION_POLL_MS = 25;
