import fs from "node:fs";
import path from "node:path";

import { retireLockDirectory } from "../../../internal/retireLockDirectory";
import { DependencyBuildGeneration } from "./DependencyBuildGeneration";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * The on-disk layout of the fenced dependency-build lock, and the one operation
 * that frees it.
 *
 * `<lockDir>/current` is the held generation: a directory carrying its id and
 * its owner. It is only ever freed by renaming it to its deterministic
 * tombstone `<lockDir>/retired/<generation>`, so a late or duplicate retire of
 * an old generation finds the tombstone occupied and fails instead of moving a
 * successor under a stable cooperative namespace, noncolliding generation
 * identities and retained tombstones for outstanding fences. The protocol does
 * not authenticate a supplied identifier or pin the namespace with a filesystem
 * handle. This mirrors the source-plugin lock protocol.
 *
 * @evidence contracts/common.md#principled-implementation Deterministic per-generation tombstones reject duplicate or stale retirement under the cooperative namespace, noncollision and retained-history premises; the identifier is not independently authenticated.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns lock layout, timing constants and retirement, leaving acquisition and observation to their distinct operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Retirement uses the supported atomic rename protocol rather than clearing current recursively or inferring authority from a timeout alone.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains current and retired roles and conditional successor safety; constants describe policy units and individual retirement/diagnostic functions document their effects.
 * @evidence contracts/portability.md#os-neutral-implementation Node path/fs represent the native lock layout; shared retireLockDirectory classifies missing or occupied destinations and Windows refusals eligible for retry after a sibling probe. That sample does not prove a peer holds the source, and namespace stability remains a cooperative caller premise.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms This namespace groups layout and operations; the retirement and duration functions explain their own costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace has no completed computation cache; build sharing belongs to the lock's caller.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The grouping does not independently acquire resources; retirement states tombstone lifetime and release limitations.
 */
export namespace DependencyBuildLockProtocol {
  /** Directory name of the held generation inside the lock directory. */
  export const DEP_BUILD_LOCK_CURRENT_DIR = "current";

  /** Directory holding one tombstone per retired generation. */
  export const DEP_BUILD_LOCK_RETIRED_DIR = "retired";

  /** File inside a generation directory holding its hex id. */
  export const DEP_BUILD_LOCK_GENERATION_FILE = "generation";

  /**
   * How long one wait of the lock protocol yields: a waiter's poll of the
   * holder, and a retire's wait for a peer's read of the held generation to end
   * (`retireLockDirectory`).
   */
  export const DEP_BUILD_LOCK_POLL_MS = 50;

  /**
   * Elapsed-time policy threshold checked between runtime acquisition attempts;
   * not a native IO or retirement deadline.
   */
  export const DEP_BUILD_LOCK_WAIT_MS = 600_000;

  /** File inside a generation directory recording the holder's pid and host. */
  export const DEP_BUILD_LOCK_OWNER_FILE = "owner.json";

  /**
   * Retire a caller-acquired or observed `generation` by renaming `current`
   * onto its tombstone. With stable cooperative layout, noncolliding ids and
   * retained tombstones, an old fence cannot move a successor. The operation
   * validates spelling but does not reread or authenticate current ownership.
   * Invalid spelling, missing layout or an occupied destination returns false;
   * unexpected filesystem errors propagate. Eligible Windows refusals retry
   * after a sibling probe without an independent retirement deadline.
   *
   * @evidence contracts/common.md#principled-implementation A caller-acquired or observed generation selects its fixed tombstone; an occupied historical destination rejects stale rename under the stable namespace, noncollision and retained-history premises rather than authenticating a supplied string.
   * @evidence contracts/common.md#clear-and-simple-design The operation validates the identifier and prepares retired before delegating one native rename boundary; polling behavior is supplied explicitly to the shared owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing layout returns false and unexpected errors propagate; no unconditional deletion bypasses the deterministic destination fence.
   * @evidence contracts/common.md#meaningful-documentation Native prose describes input authority premises, actual false/error branches and sampled Windows retry eligibility instead of certifying current ownership or bounded cleanup.
   * @evidence contracts/portability.md#os-neutral-implementation Node path/fs construct current and destination in the caller's native namespace. The shared helper isolates platform rename errors and sampled Windows retry eligibility; a successful sibling probe does not certify a peer actor or pin the source namespace.
   * @evidence contracts/performance.md#efficient-algorithms Generation validation and path construction scale with supplied text; mkdir and delegated rename/existence/random sibling probe/removal perform native work. Each eligible retry allocates a four-byte wait view and yields 50 milliseconds, with no attempt cap or explicit retired-history scan; recursive probe removal remains delegated work.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Retirement changes generation ownership and cannot reuse a past boolean as authority for a new effect.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retired generations remain one tombstone each while stale fences can exist; population grows until the caller removes the container under its coordination policy. Eligible retries have no deadline and failed best-effort probe cleanup can leave sibling artifacts; false or a native exception is not a successful release.
   */
  export function retireDependencyBuildLock(
    lockDir: string,
    generation: string,
  ): boolean {
    if (!DependencyBuildGeneration.isDependencyGeneration(generation)) {
      return false;
    }
    const retiredDir = path.join(lockDir, DEP_BUILD_LOCK_RETIRED_DIR);
    try {
      fs.mkdirSync(retiredDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        if (RuntimeFilesystem.isMissingPathError(error)) {
          return false;
        }
        throw error;
      }
    }
    return retireLockDirectory(
      path.join(lockDir, DEP_BUILD_LOCK_CURRENT_DIR),
      path.join(retiredDir, generation),
      () =>
        Atomics.wait(
          new Int32Array(new SharedArrayBuffer(4)),
          0,
          0,
          DEP_BUILD_LOCK_POLL_MS,
        ),
    );
  }

  /**
   * Render a millisecond duration for lock diagnostics (`137ms`, `42s`, `9m
   * 3s`). Nonfinite input renders unknown time; subsecond negatives clamp to
   * zero.
   *
   * @evidence contracts/common.md#principled-implementation Finite milliseconds select rounded subsecond text or floored seconds/minutes with a remainder; unknown durations remain explicit instead of producing NaN diagnostic text.
   * @evidence contracts/common.md#clear-and-simple-design Three direct numeric cases express units without locale state or a general formatting framework.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unit thresholds are definition-based constants and do not encode expected lock ages or measurement results.
   * @evidence contracts/common.md#meaningful-documentation Native prose provides units, examples and nonfinite/negative handling for diagnostic callers.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This numeric string formatter uses no native filesystem or process boundary.
   *
   * @evidence contracts/performance.md#efficient-algorithms Fixed arithmetic and one short string construction require constant operations independent of lock history.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Formatting one supplied duration owns no cross-request computation coordinator.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The formatter retains no duration history or native resource.
   */
  export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms)) {
      return "an unknown time";
    }
    if (ms < 1_000) {
      return `${Math.max(0, Math.round(ms))}ms`;
    }
    const seconds = Math.floor(ms / 1_000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes === 0 ? `${seconds}s` : `${minutes}m ${remainder}s`;
  }
}
