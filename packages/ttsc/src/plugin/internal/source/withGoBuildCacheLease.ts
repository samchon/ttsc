import { OwnedSynchronousProcess } from "../../../internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../internal/SourceNativeRetirement";
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
 * Owned native tasks also register lifetime guards, including caller-selected
 * unmanaged Go caches. Such guards protect inputs from clean/GC without
 * granting eviction ownership or preventing independent shared-cache builds.
 * Unknown closure defers record cleanup; ordinary synchronous callers acquire
 * no new native-retirement metadata.
 *
 * Protection for unguarded calls assumes the coordination heartbeat stays
 * within its freshness grace; a later suspension or refresh failure is not
 * process-absence proof. The lease covers the synchronous callback invocation,
 * not later asynchronous work it might return. Finish requests refresher
 * shutdown and record cleanup; this synchronous function does not join
 * termination or guarantee native removal. An opted-in asynchronous owner joins
 * tracked heartbeat exit/close and receives termination failures after this
 * operation unwinds. Scoped cancellation checks admission and callback
 * completion and interrupts contention sleeps. Every acquired record still
 * requests finish before cancellation leaves this operation.
 *
 * @evidence contracts/common.md#principled-implementation Publishing before scanning maintenance makes either ordering visible to the other participant under the coordination freshness premise; startup acknowledgment does not prove continued heartbeat progress, and lease cleanup covers the scan and callback.
 * @evidence contracts/common.md#clear-and-simple-design Unmanaged caches bypass heartbeat/eviction coordination but owned native tasks register lifetime guards; one retry loop owns managed lease acquisition, maintenance negotiation and finally release.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Maintenance uses the shared live-record protocol instead of assuming no other process writes the cache; contention retries address the actual arbitration requirement.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the two possible arrival orders and why independent builds remain concurrent, with distinct acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Managed roots are physically canonicalized and Node-backed lease/heartbeat operations isolate native coordination details.
 * @evidence contracts/performance.md#efficient-algorithms Each attempt publishes a record and scans maintenance entries and their path/JSON/mtime bytes, with native directory validation. Contention sleeps between attempts; heartbeat startup adds a worker or Node-child readiness handshake before the callback. Separate builders are not serialized when maintenance is absent. The callback's own build cost is delegated; native calls and startup observation can exceed a between-attempt admission budget check.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A lease protects an individual effectful build; equivalent binary reuse belongs to the outer plugin-key build owner.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources Each attempt owns one published record and, after successful startup, one refresher capability. Finally calls finish after scan/startup failure or synchronous callback completion; unresolved native boundaries defer record completion until qualified recovery; this synchronous operation does not join termination, but an opted-in asynchronous owner joins tracked exit/close and receives termination failures. Record/ready-file cleanup is best-effort. A failed worker startup may overlap its requested termination with child fallback; leftover records follow freshness/uncertainty policy rather than a guaranteed removal bound. A returned asynchronous task is outside this callback-invocation lease.
 */
export function withGoBuildCacheLease<T>(
  root: string,
  managed: boolean,
  callback: (cacheRoot: string) => T,
): T {
  OwnedSynchronousProcess.checkpoint();
  if (!managed) {
    SourceNativeRetirement.registerSharedRoot(root);
    try {
      const result = callback(root);
      OwnedSynchronousProcess.checkpoint();
      return result;
    } finally {
      SourceNativeRetirement.release(() => SourceNativeRetirement.forget(root));
    }
  }
  const cacheRoot = GoBuildCacheCoordination.canonicalGoBuildCacheRoot(root);
  const started = performance.now();
  for (;;) {
    OwnedSynchronousProcess.checkpoint();
    const lease = GoBuildCacheCoordination.createGoBuildCacheCoordinationRecord(
      cacheRoot,
      GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR,
    );
    try {
      OwnedSynchronousProcess.checkpoint();
      const maintenance =
        GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(
          cacheRoot,
          GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR,
          Date.now(),
        );
      OwnedSynchronousProcess.checkpoint();
      if (maintenance.length === 0) {
        if (!lease.startHeartbeat()) {
          throw new Error(
            `ttsc: unable to start Go build cache lease heartbeat at ${cacheRoot}`,
          );
        }
        OwnedSynchronousProcess.checkpoint();
        const result = callback(cacheRoot);
        OwnedSynchronousProcess.checkpoint();
        return result;
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
    OwnedSynchronousProcess.sleep(GO_BUILD_CACHE_COORDINATION_POLL_MS);
  }
}

const GO_BUILD_CACHE_COORDINATION_POLL_MS = 25;
