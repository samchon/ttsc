import { runHoldingLock } from "../../../internal/runHoldingLock";
import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";
import { DependencyBuildLockProtocol } from "./DependencyBuildLockProtocol";
import { acquireDependencyBuildLock } from "./acquireDependencyBuildLock";
import { inspectDependencyBuildLock } from "./inspectDependencyBuildLock";
import { readDependencyCache } from "./readDependencyCache";
import { reclaimDependencyBuildLock } from "./reclaimDependencyBuildLock";
import { releaseDependencyBuildLock } from "./releaseDependencyBuildLock";

/**
 * Admit a dependency builder without interpreting elapsed wait as owner death.
 *
 * @evidence contracts/common.md#principled-implementation Inspection supplies abandonment authority; a monotonic admission budget only limits the contender's waiting and cannot retire a live generation.
 * @evidence contracts/common.md#clear-and-simple-design Run owns acquisition and release; wait reports publication and inspected ownership without retiring a generation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Expiration throws instead of granting reclaim authority; only an inspected abandoned fence reaches the retirement operation.
 * @evidence contracts/common.md#meaningful-documentation Public operations distinguish admission budget from holder liveness and state the optional coordination fallback.
 * @evidence contracts/portability.md#os-neutral-implementation Native lock operations and shared cache readers own filesystem semantics; monotonic time measures waiting independently of wall-clock changes.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups the run and wait operations that describe their costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Run and wait own cache validation and reuse admission.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Run owns the acquired lease; wait retains only local observations.
 */
export namespace DependencyBuildAdmission {
  /**
   * Observation returned without changing a peer's lock ownership.
   *
   * @evidence contracts/common.md#principled-implementation Built publication, normal release and inspected abandonment remain distinct states; abandonment carries the exact observed generation fence.
   * @evidence contracts/common.md#clear-and-simple-design A discriminated union requires consumers to handle publication separately from lock reacquisition and reclaim.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts There is no timeout outcome granting a peer retirement authority.
   * @evidence contracts/common.md#meaningful-documentation The native purpose states this result cannot itself change ownership.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This union describes already-inspected state; run and wait own native cache and lock operations.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This outcome type selects no processing algorithm; run and wait own observation costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type describes validated publication or peer state without authorizing independent reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Outcome values acquire no handle or independent history; the waiting caller owns the returned observation.
   */
  export type WaitResult =
    | { outcome: "built"; built: DependencyBuildGeneration.BuiltProject }
    | { outcome: "released" }
    | { outcome: "abandoned"; reason: string; fence: DependencyBuildLockFence };

  /**
   * Run one builder with a fenced lease, or reuse a complete publication.
   * An unusable coordination directory retains the existing private-output
   * fallback. One budget covers every acquisition attempt and peer turnover.
   *
   * @evidence contracts/common.md#principled-implementation Cache validation precedes acquisition and repeats after ownership; retirement receives only an inspected abandoned generation and release receives only this contender's acquired lease.
   * @evidence contracts/common.md#clear-and-simple-design This operation owns admission, budget, cache rechecks and lease lifecycle; wait owns passive observation and runHoldingLock owns release error handling.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Live timeout fails safe, retries share one deadline, and an inaccessible coordination directory does not fabricate a cached result or skip the build.
   * @evidence contracts/common.md#meaningful-documentation Native prose states lease, fallback and complete admission-budget ownership before the acknowledgments.
   * @evidence contracts/portability.md#os-neutral-implementation Shared native lease operations classify filesystem behavior; the timeout uses performance.now rather than OS names or wall-clock subtraction.
   * @evidence contracts/performance.md#efficient-algorithms Each admission attempt checks fixed lock coordinates and validates publication at the cost of marker bytes plus worst-case emit-directory entries; contention polling sleeps rather than spinning, and one monotonic budget limits admission retries while native retirement can wait on peer-held handles.
   * @evidence contracts/performance.md#reuse-equivalent-work A validated publication is checked before and after acquisition; the build callback runs only when no reusable publication exists under the admitted lease or explicit private-output fallback.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The acquired lease is released through runHoldingLock on success or failure; no peer lease is held by this contender and retries retain no observation history.
   */
  export function run(
    cacheDir: string,
    metaPath: string,
    lockDir: string,
    build: () => DependencyBuildGeneration.BuiltProject,
    timeoutMs = DependencyBuildLockProtocol.DEP_BUILD_LOCK_WAIT_MS,
  ): DependencyBuildGeneration.BuiltProject {
    assertWaitBudget(timeoutMs);
    const startedAt = performance.now();
    for (;;) {
      const reuse = readDependencyCache(cacheDir, metaPath);
      if (reuse !== null) return reuse;
      const remaining = timeoutMs - (performance.now() - startedAt);
      if (remaining <= 0) throw timeoutError(timeoutMs);
      let lease;
      try {
        lease = acquireDependencyBuildLock(lockDir);
      } catch {
        return build();
      }
      if (lease === null) {
        const waited = wait(cacheDir, metaPath, lockDir,
          Math.max(0, timeoutMs - (performance.now() - startedAt)));
        if (waited.outcome === "built") return waited.built;
        if (waited.outcome === "abandoned")
          reclaimDependencyBuildLock(lockDir, waited.fence);
        continue;
      }
      const held = lease;
      return runHoldingLock(
        () => readDependencyCache(cacheDir, metaPath) ?? build(),
        () => releaseDependencyBuildLock(lockDir, held),
        () => undefined,
      );
    }
  }

  /**
   * Observe a peer for at most the remaining contender budget. A live holder
   * survives budget expiration; publication and normal release are rechecked.
   *
   * @evidence contracts/common.md#principled-implementation Cache publication is authoritative; released observation triggers a second cache read and only inspected abandonment produces a reclaim fence.
   * @evidence contracts/common.md#clear-and-simple-design This passive operation reports peer state or throws on expiration without acquiring, releasing or retiring a lock.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Elapsed time is never converted into owner-death evidence and wall-clock movement cannot renew the contender budget.
   * @evidence contracts/common.md#meaningful-documentation Native prose states remaining-budget ownership and preserves live holder authority on expiration.
   * @evidence contracts/portability.md#os-neutral-implementation Native inspection owns peer identity; wall time remains only its ownerless-publication age input, while performance.now owns elapsed waiting.
   * @evidence contracts/performance.md#efficient-algorithms Each poll checks fixed lock coordinates and validates publication at the cost of marker bytes plus worst-case emit-directory entries; sleeping uses the smaller of the polling interval and remaining budget, without scanning lock history.
   * @evidence contracts/performance.md#reuse-equivalent-work Only the shared validated cache reader establishes reusable publication; neither a live observation nor elapsed time invents a build result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This observer owns no lease or filesystem handle and keeps only the current observation and monotonic start time.
   */
  export function wait(
    cacheDir: string,
    metaPath: string,
    lockDir: string,
    timeoutMs: number,
  ): WaitResult {
    assertWaitBudget(timeoutMs);
    const startedAt = performance.now();
    for (;;) {
      const reuse = readDependencyCache(cacheDir, metaPath);
      if (reuse !== null) return { outcome: "built", built: reuse };
      const lock = inspectDependencyBuildLock(lockDir, Date.now());
      if (lock.state === "released") {
        const built = readDependencyCache(cacheDir, metaPath);
        return built !== null ? { outcome: "built", built } : { outcome: "released" };
      }
      if (lock.state === "abandoned")
        return { outcome: "abandoned", reason: lock.reason, fence: lock.fence };
      const remaining = timeoutMs - (performance.now() - startedAt);
      if (remaining <= 0) throw timeoutError(timeoutMs);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0,
        Math.min(DependencyBuildLockProtocol.DEP_BUILD_LOCK_POLL_MS, remaining));
    }
  }
}

/**
 * Expiration limits a contender; it never grants retirement authority.
 */
function timeoutError(timeoutMs: number): Error {
  return new Error(`ttsx: dependency build admission timed out after ${DependencyBuildLockProtocol.formatDuration(timeoutMs)}; the holding generation was not retired`);
}

/**
 * Require a finite nonnegative admission budget before polling.
 */
function assertWaitBudget(timeoutMs: number): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0)
    throw new RangeError("ttsx: dependency build admission budget must be finite and nonnegative");
}
