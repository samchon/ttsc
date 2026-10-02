import crypto from "node:crypto";
import fs from "node:fs";

/**
 * Free a held lock generation by renaming its directory onto its tombstone, the
 * one operation both build-lock protocols retire a generation with.
 *
 * Windows refuses to rename a directory while any file below it is open, and
 * reports the refusal as `EPERM` or `EACCES` (or `EBUSY`). Every waiter of a
 * lock reads the holder's record inside the held generation, so a release that
 * overlaps one of those reads is refused for as long as the read lasts
 * (samchon/ttsc#1510). That refusal is transient; a lasting one, which the
 * filesystem's permissions would cause, is not. The two are told apart by
 * evidence rather than a time window: an empty directory, which no peer can
 * hold open, is renamed between the same two parents. When that probe renames,
 * the parents permit renaming a newly created sibling. Under the protocol's
 * caller-owned generation premise this permits a retry after `yieldToPeers`. It
 * does not prove that source-specific permissions or attributes allow the held
 * directory to move. There is no retry deadline. When the probe is refused too,
 * the refusal is the filesystem's and is thrown.
 *
 * @param source The held generation's directory.
 * @param destination Its tombstone, which a successor's retire can never reuse.
 * @param yieldToPeers Waits once, by the protocol's own polling interval.
 *
 * @returns `true` when the generation was retired; `false` when `source` is
 *   gone or `destination` is occupied, meaning another retire already made
 *   progress.
 *
 * @throws When the rename fails for any other reason.
 *
 * @evidence contracts/common.md#principled-implementation Renaming the held generation to its unique tombstone is the ownership transition; missing or occupied paths indicate peer progress. A Windows sibling probe permits retry under caller-owned generation assumptions but cannot rule out source-specific restrictions.
 * @evidence contracts/common.md#clear-and-simple-design One retirement loop delegates missing/occupied classification and native peer-contention probing to private helpers; polling timing remains with the lock protocol caller.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Windows retry addresses supported peer reads beneath the held generation rather than overriding filesystem methods; the source-specific restriction uncertainty remains explicit instead of being described as a proved peer cause.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain tombstone ownership, supported contention, probe limits and absent deadline; outcome and yield meanings remain separately documented.
 * @evidence contracts/portability.md#os-neutral-implementation Node rename and errno classification carry native behavior; only Windows access/busy refusals invoke the sibling probe, and POSIX unrelated failures propagate.
 * @evidence contracts/performance.md#efficient-algorithms Each attempt performs one rename and at most one fixed-size sibling probe; total work grows with contention attempts and has no imposed attempt cap.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A rename and its contention observations are mutable ownership effects; replaying a previous result would not retire the current generation.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources The operation retires one caller-held generation and attempts to remove each temporary probe; a refused probe removal leaves that empty sibling directory behind without changing the retry decision, and repeated contention retains the call indefinitely because this primitive has no retry deadline, while protocol cleanup owns the retired tombstone.
 */
export function retireLockDirectory(
  source: string,
  destination: string,
  yieldToPeers: () => void,
): boolean {
  for (;;) {
    try {
      fs.renameSync(source, destination);
      return true;
    } catch (error) {
      if (isMissingPath(error) || isOccupied(error, destination)) return false;
      if (!isHeldByPeer(error, source, destination)) throw error;
    }
    yieldToPeers();
  }
}

function isMissingPath(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/**
 * Whether a failed rename means the destination already exists. Windows reports
 * an occupied directory destination as `EACCES` or `EPERM`, so those count only
 * when the destination is actually present.
 */
function isOccupied(error: unknown, destination: string): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EEXIST" || code === "ENOTEMPTY") return true;
  return (code === "EACCES" || code === "EPERM") && fs.existsSync(destination);
}

/**
 * Whether a refused rename was refused by a peer's open file below `source`
 * rather than by the filesystem's permissions.
 */
function isHeldByPeer(
  error: unknown,
  source: string,
  destination: string,
): boolean {
  if (process.platform !== "win32") return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") return false;
  if (!fs.existsSync(source)) return false;
  const nonce = crypto.randomBytes(8).toString("hex");
  const probe = `${source}.probe-${nonce}`;
  const moved = `${destination}.probe-${nonce}`;
  try {
    fs.mkdirSync(probe);
  } catch {
    return false;
  }
  try {
    fs.renameSync(probe, moved);
  } catch {
    removeProbe(probe);
    return false;
  }
  removeProbe(moved);
  return true;
}

/**
 * Remove a probe directory without letting its removal decide the retry. The
 * probe only answers whether the parents permit a rename, so a transient
 * refusal to delete the empty directory (an indexer or scanner holding it on
 * Windows) leaves that directory behind rather than turning a peer contention
 * into a thrown failure.
 */
function removeProbe(directory: string): void {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch {
    // The probe is an empty sibling of the lock; its answer is already known.
  }
}
