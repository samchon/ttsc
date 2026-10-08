import crypto from "node:crypto";
import fs from "node:fs";

import { OwnedSynchronousProcess } from "./OwnedSynchronousProcess";
import type { RetireLockDirectoryOperations } from "./RetireLockDirectoryOperations";

/**
 * Free a held lock generation by renaming its directory onto its tombstone, the
 * one operation both build-lock protocols retire a generation with.
 *
 * Windows access or busy refusals can occur while peers read the holder's
 * record inside the held generation. The error alone does not identify the
 * cause or duration. The policy samples a newly created empty sibling rename
 * between the same parents rather than using a time window. A successful probe
 * establishes that this sampled sibling move succeeded. Under the protocol's
 * caller-owned generation premise this permits a retry after `yieldToPeers`. It
 * does not prove that source-specific permissions or attributes allow the held
 * directory to move. Ordinary work has no retry deadline. Once scoped
 * cancellation is observed, cleanup permits one second of further contention:
 * this leaves the request owner's shutdown budget for other releases while
 * allowing transient readers to yield. Expiry reports the last real refusal as
 * the cause of cleanup failure, never successful retirement. An opted-in owner
 * also receives that failure through its scope when a legacy caller catches the
 * thrown exception. Native calls and the caller's yield can exceed that
 * between-attempt grace. When the probe is refused too, the original retirement
 * refusal is thrown; the probe failure does not prove a particular permission
 * or sharing cause.
 *
 * @param source The held generation's directory.
 * @param destination Its tombstone, which a successor's retire can never reuse.
 * @param yieldToPeers Waits once, by the protocol's own polling interval.
 * @param operations Filesystem and platform primitives; the real filesystem and
 *   `process.platform` by default, injectable so the Windows-only probe
 *   branches can be exercised on any host.
 * @returns `true` when the generation was retired; `false` when `source` is
 *   reported missing or `destination` is observed occupied. Those outcomes are
 *   treated as peer progress, without proving which actor changed the paths.
 * @throws When the rename fails for any other reason.
 * @evidence contracts/common.md#principled-implementation Renaming the held generation to its unique tombstone is the ownership transition; reported missing or occupied paths are treated as peer progress. A successful Windows sibling probe permits retry under caller-owned generation assumptions but cannot identify the original refusal's cause or rule out source-specific restrictions. Scoped cancelled cleanup stops retry admission after one second and preserves the last real refusal as failure cause; reporting it to the explicit owner preserves that failure across legacy outcome conversion.
 * @evidence contracts/common.md#clear-and-simple-design One retirement loop delegates missing/occupied classification and native peer-contention probing to private helpers; polling timing remains with the lock protocol caller, and one optional operations argument is the only seam, defaulting to the real filesystem and platform.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Windows retry addresses supported peer reads beneath the held generation rather than overriding filesystem methods; the source-specific restriction uncertainty remains explicit instead of being described as a proved peer cause. The injectable operations are a typed boundary that must report real native results and codes, not a replacement of foreign filesystem methods.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain tombstone ownership, supported contention, probe limits, ordinary unbounded retries and the cancelled-cleanup admission grace; outcome and yield meanings remain separately documented.
 * @evidence contracts/portability.md#os-neutral-implementation Node rename and errno classification carry native behavior; only Windows access/busy refusals invoke the sibling probe, selected by the operations' platform value (the process platform by default), and POSIX unrelated failures propagate.
 * @evidence contracts/performance.md#efficient-algorithms Each attempt performs one retirement rename and at most one sibling probe with a fixed-length random suffix. Path strings scale with source/destination text; native existence, allocation, rename and removal work and the supplied yield callback are delegated costs. Ordinary retries have no cap; cancelled retries check a one-second monotonic grace between native attempts and yields; no explicit directory enumeration occurs unless delegated recursive probe cleanup needs it.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A rename and its contention observations are mutable ownership effects; replaying a previous result would not retire the current generation.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The operation retires one caller-held generation and attempts to remove each temporary probe; a refused probe removal leaves that empty sibling directory behind without changing the retry decision, ordinary repeated contention can retain the call indefinitely, while scoped cancelled cleanup fails after its between-attempt grace with the last refusal as cause. Native calls/yields are not hard bounded; protocol cleanup owns the retired tombstone.
 */
export function retireLockDirectory(
  source: string,
  destination: string,
  yieldToPeers: () => void,
  operations: RetireLockDirectoryOperations = FILESYSTEM_OPERATIONS,
): boolean {
  let cancelledAt: number | undefined;
  try {
    for (;;) {
      try {
        operations.renameSync(source, destination);
        return true;
      } catch (error) {
        if (isMissingPath(error) || isOccupied(error, destination, operations))
          return false;
        if (!isHeldByPeer(error, source, destination, operations)) throw error;
        if (OwnedSynchronousProcess.cancelled()) {
          cancelledAt ??= performance.now();
          if (performance.now() - cancelledAt >= CANCELLED_CLEANUP_GRACE_MS)
            throw new Error(
              `ttsc: unable to retire lock generation ${source} after ` +
                `${CANCELLED_CLEANUP_GRACE_MS}ms of cancelled cleanup contention`,
              { cause: error },
            );
        }
      }
      yieldToPeers();
    }
  } catch (error) {
    if (OwnedSynchronousProcess.cancelled())
      OwnedSynchronousProcess.reportFailure(error);
    throw error;
  }
}

const CANCELLED_CLEANUP_GRACE_MS = 1_000;

function isMissingPath(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * Whether a failed rename means the destination already exists. Windows reports
 * an occupied directory destination as `EACCES` or `EPERM`, so those count only
 * when the destination is actually present.
 */
function isOccupied(
  error: unknown,
  destination: string,
  operations: RetireLockDirectoryOperations,
): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EEXIST" || code === "ENOTEMPTY") return true;
  return (
    (code === "EACCES" || code === "EPERM") &&
    operations.existsSync(destination)
  );
}

/**
 * Whether this refusal qualifies for retry after a successful sibling probe.
 * The result does not identify a peer or exclude source-specific restrictions.
 */
function isHeldByPeer(
  error: unknown,
  source: string,
  destination: string,
  operations: RetireLockDirectoryOperations,
): boolean {
  if (operations.platform !== "win32") return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") return false;
  if (!operations.existsSync(source)) return false;
  const nonce = crypto.randomBytes(8).toString("hex");
  const probe = `${source}.probe-${nonce}`;
  const moved = `${destination}.probe-${nonce}`;
  try {
    operations.mkdirSync(probe);
  } catch {
    return false;
  }
  try {
    operations.renameSync(probe, moved);
  } catch {
    removeProbe(probe, operations);
    return false;
  }
  removeProbe(moved, operations);
  return true;
}

/**
 * Remove a probe directory without letting its removal decide the retry. The
 * probe records whether its sampled sibling rename succeeded, so a transient
 * refusal to delete the empty directory (an indexer or scanner holding it on
 * Windows) leaves that directory behind rather than turning an eligible retry
 * into a thrown failure.
 */
function removeProbe(
  directory: string,
  operations: RetireLockDirectoryOperations,
): void {
  try {
    operations.rmSync(directory, { force: true, recursive: true });
  } catch {
    // The probe is an empty sibling of the lock; its answer is already known.
  }
}

const FILESYSTEM_OPERATIONS: RetireLockDirectoryOperations = {
  renameSync: fs.renameSync,
  mkdirSync: (location) => fs.mkdirSync(location),
  rmSync: fs.rmSync,
  existsSync: fs.existsSync,
  platform: process.platform,
};
