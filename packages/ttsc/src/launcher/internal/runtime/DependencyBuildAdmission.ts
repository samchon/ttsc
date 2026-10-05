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
 * @evidence contracts/common.md#principled-implementation Inspection supplies policy-selected abandonment grounds; the contender's monotonic budget itself grants no retirement authority. Inspector stale unreadable-owner policy remains distinct from proof of process death.
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
   * @evidence contracts/portability.md#os-neutral-implementation Built results carry native generation/root/provenance paths; abandoned results carry diagnostic reason text and a hexadecimal generation fence, not authenticated pid authority. Released describes an observed absence, not acquisition; the inspector and reader own native observations and their uncertainty.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This outcome type selects no processing algorithm; run and wait own observation costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The type describes validated publication or peer state without authorizing independent reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Outcome values acquire no handle or independent history; the waiting caller owns the returned observation.
   */
  export type WaitResult =
    | { outcome: "built"; built: DependencyBuildGeneration.BuiltProject }
    | { outcome: "released" }
    | { outcome: "abandoned"; reason: string; fence: DependencyBuildLockFence };

  /**
   * Run one builder with a fenced lease, or reuse an accepted publication. Any
   * acquisition exception invokes the existing uncoordinated build fallback,
   * including failures after partial lock publication; it does not authenticate
   * the namespace or guarantee that no held generation remains. One monotonic
   * budget is checked across attempts and peer turnover, not as a hard deadline
   * for native calls, building or retirement.
   *
   * @evidence contracts/common.md#principled-implementation Cache validation precedes acquisition and repeats after ownership; retirement receives only an inspected abandoned generation and release receives only this contender's acquired lease.
   * @evidence contracts/common.md#clear-and-simple-design This operation owns admission, budget, cache rechecks and lease lifecycle; wait owns passive observation and runHoldingLock owns release error handling.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Contender expiration throws rather than authorizing retirement; acquisition exceptions invoke the actual build fallback instead of fabricating a hit, while inspected abandonment still follows the inspector's stale-record policy.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the actual broad acquisition-exception fallback, partial-state possibility and checked-budget scope without certifying a hard native deadline.
   * @evidence contracts/portability.md#os-neutral-implementation Shared native lease operations classify filesystem behavior; the timeout uses performance.now rather than OS names or wall-clock subtraction.
   * @evidence contracts/performance.md#efficient-algorithms Each attempt adds reader marker/provenance/path/walk/identity work and native acquisition or inspection costs; fixed coordinates do not bound bytes or native latency. Polls yield instead of spinning, but native retirement and the build callback can outlast the contender budget.
   * @evidence contracts/performance.md#reuse-equivalent-work Publication shape/presence is checked before and after acquisition under cooperative immutable-generation premises. The callback runs after an admitted miss or any acquisition exception; this operation does not independently authenticate marker observations or caller cache-key equivalence.
   * @evidence contracts/performance.md#bound-retention-and-release-resources runHoldingLock attempts acquired-lease release on either synchronous work outcome, ignores a false release result and suppresses thrown release errors through the supplied no-op reporter; recovery can remain necessary. No peer lease or historical observation list is retained, while build artifacts, tombstones and partial acquisition state follow their caller/protocol lifetime policies.
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
        const waited = wait(
          cacheDir,
          metaPath,
          lockDir,
          Math.max(0, timeoutMs - (performance.now() - startedAt)),
        );
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
   * Observe publication and peer state, checking the remaining contender budget
   * after cache and ownership reads. This operation never retires a generation;
   * native observations can outlast the budget and return a newly observed
   * publication, release or policy-selected abandonment before its next check.
   *
   * @evidence contracts/common.md#principled-implementation An accepted cache record returns a built result under cooperative publication premises; released observation triggers a second read, and only inspector-selected abandonment supplies a fence rather than turning contender expiration into authority.
   * @evidence contracts/common.md#clear-and-simple-design This passive operation reports peer state or throws on expiration without acquiring, releasing or retiring a lock.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Elapsed time is never converted into owner-death evidence and wall-clock movement cannot renew the contender budget.
   * @evidence contracts/common.md#meaningful-documentation Native prose states read-before-budget-check ordering and passive observation, without promising a hard native deadline or authenticating holder state.
   * @evidence contracts/portability.md#os-neutral-implementation Native inspection owns peer identity; wall time remains only its ownerless-publication age input, while performance.now owns elapsed waiting.
   * @evidence contracts/performance.md#efficient-algorithms Each poll delegates marker/provenance/path/walk/identity validation and native generation/owner reads and liveness or age observations. Poll count and native latency are not bounded by fixed coordinates; each sleep allocates a four-byte wait view and uses the smaller polling interval/remaining budget, without scanning lock history.
   * @evidence contracts/performance.md#reuse-equivalent-work The shared reader checks publication shape and presence under cooperative generation premises; neither an active observation nor contender elapsed time invents a build result or independently proves caller cache-key equivalence.
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
        return built !== null
          ? { outcome: "built", built }
          : { outcome: "released" };
      }
      if (lock.state === "abandoned")
        return { outcome: "abandoned", reason: lock.reason, fence: lock.fence };
      const remaining = timeoutMs - (performance.now() - startedAt);
      if (remaining <= 0) throw timeoutError(timeoutMs);
      Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        Math.min(DependencyBuildLockProtocol.DEP_BUILD_LOCK_POLL_MS, remaining),
      );
    }
  }
}

/** Expiration limits a contender; it never grants retirement authority. */
function timeoutError(timeoutMs: number): Error {
  return new Error(
    `ttsx: dependency build admission timed out after ${DependencyBuildLockProtocol.formatDuration(timeoutMs)}; the holding generation was not retired`,
  );
}

/** Require a finite nonnegative admission budget before polling. */
function assertWaitBudget(timeoutMs: number): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0)
    throw new RangeError(
      "ttsx: dependency build admission budget must be finite and nonnegative",
    );
}
